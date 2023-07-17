from __future__ import annotations

import gc
import os
import shutil
import time
import warnings
from typing import List, Optional, Union

import torch
import transformers
from transformers import AutoConfig, AutoModelForCausalLM, LogitsProcessorList

import utils
from logger import logger
import koboldai_settings
from modeling import warpers
from modeling.inference_model import (
    GenerationResult,
    GenerationSettings,
    InferenceModel,
    use_core_manipulations,
)

model_backend_name = "Basic Huggingface"
model_backend_type = "Huggingface"


class model_backend(InferenceModel):
    # Model backends must inherit from InferenceModel. Many HF-specific behaviors which could be inherited
    # from HFInferenceModel are not here for sake of hackability.

    def __init__(self) -> None:
        super().__init__()
        self.model_name = "Basic Huggingface"
        self.path = None

    def is_valid(self, model_name, model_path, menu_path):
        try:
            if model_path is not None and os.path.exists(model_path):
                self.model_config = AutoConfig.from_pretrained(model_path)
            elif os.path.exists("models/{}".format(model_name.replace("/", "_"))):
                self.model_config = AutoConfig.from_pretrained(
                    "models/{}".format(model_name.replace("/", "_")),
                    revision=utils.koboldai_vars.revision,
                    cache_dir="cache",
                )
            else:
                self.model_config = AutoConfig.from_pretrained(
                    model_name, revision=utils.koboldai_vars.revision, cache_dir="cache"
                )
            return True
        except:
            return False

    def get_requested_parameters(
        self, model_name: str, model_path: str, menu_path: str, parameters: dict = {}
    ):
        requested_parameters = []

        if model_name == "customhuggingface":
            requested_parameters.append(
                {
                    "uitype": "text",
                    "unit": "text",
                    "label": "Huggingface Model Name",
                    "id": "custom_model_name",
                    "default": parameters.get("custom_model_name", ""),
                    "check": {"value": "", "check": "!="},
                    "tooltip": "Model name from https://huggingface.co/",
                    "menu_path": "",
                    "refresh_model_inputs": True,
                    "extra_classes": "",
                }
            )

        if model_name != "customhuggingface" or "custom_model_name" in parameters:
            model_name = parameters.get("custom_model_name", None) or model_name
            alt_model_path = self.get_local_model_path()

            if model_path and os.path.exists(model_path):
                # Use passed model path
                self.model_config = AutoConfig.from_pretrained(model_path)
            elif alt_model_path:
                # Use known model path
                self.model_config = AutoConfig.from_pretrained(
                    alt_model_path,
                    revision=utils.koboldai_vars.revision,
                    cache_dir="cache",
                )
            else:
                # No model path locally, we'll probably have to download
                self.model_config = AutoConfig.from_pretrained(
                    model_name, revision=utils.koboldai_vars.revision, cache_dir="cache"
                )

        return requested_parameters

    def set_input_parameters(self, parameters: dict):
        self.model_name = parameters.get("custom_model_name", parameters["id"])
        self.path = parameters.get("path", None)
        logger.info(parameters)

    def unload(self):
        if hasattr(self, "model"):
            self.model = None

        if hasattr(self, "tokenizer"):
            self.tokenizer = None

        if hasattr(self, "model_config"):
            self.model_config = None

        with torch.no_grad():
            with warnings.catch_warnings():
                warnings.filterwarnings(
                    "ignore", message="torch.distributed.reduce_op is deprecated"
                )
                for tensor in gc.get_objects():
                    try:
                        if torch.is_tensor(tensor):
                            tensor.set_(
                                torch.tensor(
                                    (), device=tensor.device, dtype=tensor.dtype
                                )
                            )
                    except:
                        pass
        gc.collect()

        try:
            with torch.no_grad():
                torch.cuda.empty_cache()
        except:
            pass

    def _load(self, save_model: bool, initial_load: bool) -> None:
        utils.koboldai_vars.allowsp = False

        if self.model_name == "NeoCustom":
            self.model_name = os.path.basename(os.path.normpath(self.path))
        utils.koboldai_vars.model = self.model_name

        # If we specify a model and it's in the root directory, we need to move
        # it to the models directory (legacy folder structure to new)
        if self.get_local_model_path(legacy=True):
            shutil.move(
                self.get_local_model_path(legacy=True, ignore_existance=True),
                self.get_local_model_path(ignore_existance=True),
            )

        self.init_model_config()

        self.model = AutoModelForCausalLM.from_pretrained(
            self.get_local_model_path(), low_cpu_mem_usage=True, device_map="auto"
        )

        self.tokenizer = self._get_tokenizer(self.get_local_model_path())
        self.model.kai_model = self
        self.badwordsids = koboldai_settings.badwordsids_default
        utils.koboldai_vars.modeldim = self.model.get_input_embeddings().embedding_dim

        # Patch Huggingface stuff to use our samplers
        class KoboldLogitsWarperList(LogitsProcessorList):
            def __call__(
                _self,  # Unused
                input_ids: torch.LongTensor,
                scores: torch.FloatTensor,
                *args,
                **kwargs,
            ):
                # Kobold sampling is done here.
                scores = self._apply_warpers(scores=scores, input_ids=input_ids)

                # Things like Lua integration, phrase bias, and probability visualization are done here.
                for processor in self.logits_processors:
                    scores = processor(self, scores=scores, input_ids=input_ids)
                    assert (
                        scores is not None
                    ), f"Scores are None; processor '{processor}' is to blame"
                return scores

        def new_sample(self, *args, **kwargs):
            assert kwargs.pop("logits_warper", None) is not None
            kwargs["logits_warper"] = KoboldLogitsWarperList()

            if utils.koboldai_vars.newlinemode in ["s", "ns"]:
                kwargs["eos_token_id"] = -1
                kwargs.setdefault("pad_token_id", 2)

            return new_sample.old_sample(self, *args, **kwargs)

        new_sample.old_sample = transformers.GenerationMixin.sample
        use_core_manipulations.sample = new_sample


    def _post_load(self) -> None:
        # Copied from HFInferenceModel. Some comments have been snipped for brevity as
        # HF patches are a little out of the scope of the basic backend. See
        # modeling/inference_models/hf.py for some killer documentation written by Lllama.

        self.badwordsids = koboldai_settings.badwordsids_default
        self.model_type = str(self.model_config.model_type)

        # These are model specific tokenizer overrides if a model has bad defaults
        if self.model_type == "llama":
            # Note: self.tokenizer is a GenericTokenizer, and self.tokenizer.tokenizer is the actual LlamaTokenizer
            self.tokenizer.add_bos_token = False
            vocab = self.tokenizer.convert_ids_to_tokens(range(self.tokenizer.vocab_size))
            has_prefix_space = {i for i, tok in enumerate(vocab) if tok.startswith("▁")}

            original_decode = type(self.tokenizer.tokenizer).decode
            def decode_wrapper(self, token_ids, *args, **kwargs):
                first = None
                if isinstance(token_ids, int):
                    first = token_ids
                    token_ids = [first]
                elif hasattr(token_ids, 'dim'):
                    if token_ids.dim() == 0:
                        first = int(token_ids.item())
                        token_ids = [first]
                    elif len(token_ids) > 0:
                        first = int(token_ids[0])
                elif token_ids is not None and len(token_ids) > 0:
                    first = token_ids[0]
                result = original_decode(self, token_ids, *args, **kwargs)
                if first is not None and first in has_prefix_space:
                    result = " " + result
                return result
            object.__setattr__(self.tokenizer, 'decode', decode_wrapper.__get__(self.tokenizer))

            original_encode = type(self.tokenizer.tokenizer).encode
            def encode_wrapper(self, text, *args, **kwargs):
                if type(text) is str:
                    text = ',' + text
                    result = original_encode(self, text, *args, **kwargs)
                    result = result[1:]
                else:
                    result = original_encode(self, text, *args, **kwargs)
                return result
            object.__setattr__(self.tokenizer, 'encode', encode_wrapper.__get__(self.tokenizer))

            original_call = type(self.tokenizer.tokenizer).__call__
            def call_wrapper(self, text, *args, **kwargs):
                if type(text) is str:
                    text = ',' + text
                    result = original_call(self, text, *args, **kwargs)
                    result = result[1:]
                else:
                    result = original_call(self, text, *args, **kwargs)
                return result
            object.__setattr__(self.tokenizer, '__call__', call_wrapper.__get__(self.tokenizer))

        elif self.model_type == "opt":
            self.tokenizer._koboldai_header = self.tokenizer.encode("")
            self.tokenizer.add_bos_token = False
            self.tokenizer.add_prefix_space = False

        # Change newline behavior to match model quirks
        if self.model_type == "xglm":
            # Default to </s> newline mode if using XGLM
            utils.koboldai_vars.newlinemode = "s"
        elif self.model_type in ["opt", "bloom"]:
            # Handle </s> but don't convert newlines if using Fairseq models that have newlines trained in them
            utils.koboldai_vars.newlinemode = "ns"

        # Clean up tokens that cause issues
        if (
            self.badwordsids == koboldai_settings.badwordsids_default
            and self.model_type not in ("gpt2", "gpt_neo", "gptj")
        ):
            self.badwordsids = [
                [v]
                for k, v in self.tokenizer.get_vocab().items()
                if any(c in str(k) for c in "[]")
            ]

            if utils.koboldai_vars.newlinemode == "n":
                self.badwordsids.append([self.tokenizer.eos_token_id])

        return super()._post_load()


    def _apply_warpers(
        self, scores: torch.Tensor, input_ids: torch.Tensor
    ) -> torch.Tensor:
        """Applies samplers/warpers to the given scores, returning the altered scores.

        Args:
            scores (torch.Tensor): The original scores.
            input_ids (torch.Tensor): The input token sequence.

        Returns:
            torch.Tensor: The altered scores.
        """
        warpers.update_settings()

        for sid in utils.koboldai_vars.sampler_order:
            warper = warpers.Warper.from_id(sid)

            if not warper.value_is_valid():
                continue

            if warper == warpers.RepetitionPenalty:
                # Rep pen needs access to input tokens to decide what to penalize
                scores = warper.torch(scores, input_ids=input_ids)
            else:
                scores = warper.torch(scores)

            assert scores is not None, f"Scores are None; warper '{warper}' is to blame"
        return scores

    def _raw_generate(
        self,
        prompt_tokens: Union[List[int], torch.Tensor],
        max_new: int,
        gen_settings: GenerationSettings,
        single_line: bool = False,
        batch_count: int = 1,
        seed: Optional[int] = None,
        **kwargs,
    ) -> GenerationResult:
        if not isinstance(prompt_tokens, torch.Tensor):
            gen_in = torch.tensor(prompt_tokens, dtype=torch.long)[None]
        else:
            gen_in = prompt_tokens

        device = self.get_auxilary_device()
        gen_in = gen_in.to(device)

        additional_bad_words_ids = [self.tokenizer.encode("\n")] if single_line else []

        if seed is not None:
            torch.manual_seed(seed)

        with torch.no_grad():
            start_time = time.time()
            genout = self.model.generate(
                gen_in,
                do_sample=True,
                max_length=min(
                    len(prompt_tokens) + max_new, utils.koboldai_vars.max_length
                ),
                repetition_penalty=1.0,
                bad_words_ids=self.badwordsids + additional_bad_words_ids,
                use_cache=True,
                num_return_sequences=batch_count,
            )

        logger.debug(
            "torch_raw_generate: run generator {}s".format(time.time() - start_time)
        )

        return GenerationResult(
            self,
            out_batches=genout,
            prompt=prompt_tokens,
            is_whole_generation=False,
            output_includes_prompt=True,
        )

    def get_local_model_path(
        self, legacy: bool = False, ignore_existance: bool = False
    ) -> Optional[str]:
        """
        Returns a string of the model's path locally, or None if it is not downloaded.
        If ignore_existance is true, it will always return a path.
        """
        if self.path is not None:
            if os.path.exists(self.path):
                return self.path

        if self.model_name in [
            "NeoCustom",
            "GPT2Custom",
            "TPUMeshTransformerGPTJ",
            "TPUMeshTransformerGPTNeoX",
        ]:
            model_path = self.path
            assert model_path

            # Path can be absolute or relative to models directory
            if os.path.exists(model_path):
                return model_path

            model_path = os.path.join("models", model_path)

            try:
                assert os.path.exists(model_path)
            except AssertionError:
                logger.error(
                    f"Custom model does not exist at '{utils.koboldai_vars.custmodpth}' or '{model_path}'."
                )
                raise

            return model_path

        basename = self.model_name.replace("/", "_")
        if legacy:
            ret = basename
        else:
            ret = os.path.join("models", basename)

        if os.path.isdir(ret) or ignore_existance:
            return ret
        return None

    def init_model_config(self) -> None:
        # Get the model_type from the config or assume a model type if it isn't present
        try:
            self.model_config = AutoConfig.from_pretrained(
                self.get_local_model_path() or self.model_name,
                revision=utils.koboldai_vars.revision,
                cache_dir="cache",
            )
            self.model_type = self.model_config.model_type
        except ValueError:
            self.model_type = {
                "NeoCustom": "gpt_neo",
                "GPT2Custom": "gpt2",
            }.get(self.model)

            if not self.model_type:
                logger.warning(
                    "No model type detected, assuming Neo (If this is a GPT2 model use the other menu option or --model GPT2Custom)"
                )
                self.model_type = "gpt_neo"
