from __future__ import annotations

import os
import json
import torch
import shutil
from typing import Union

from transformers import AutoModelForCausalLM, GPTNeoForCausalLM, GPT2LMHeadModel

import utils
import modeling.lazy_loader as lazy_loader
import koboldai_settings
from logger import logger


from modeling.inference_models.hf_torch_4bit import HFTorch4BitInferenceModel

model_backend_name = "Huggingface 4-Bit"
model_backend_type = "Huggingface" #This should be a generic name in case multiple model backends are compatible (think Hugging Face Custom and Basic Hugging Face)

class model_backend(HFTorch4BitInferenceModel):
    def _initialize_model(self):
        return

    def _load(self, save_model: bool, initial_load: bool) -> None:
        utils.koboldai_vars.allowsp = True

        # Make model path the same as the model name to make this consistent
        # with the other loading method if it isn't a known model type. This
        # code is not just a workaround for below, it is also used to make the
        # behavior consistent with other loading methods - Henk717
        # if utils.koboldai_vars.model not in ["NeoCustom", "GPT2Custom"]:
        #     utils.koboldai_vars.custmodpth = utils.koboldai_vars.model

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

        tf_kwargs = {
            "low_cpu_mem_usage": True,
        }

        self.lazy_load = False
        self.breakmodel = False

        logger.debug(
            "lazy_load: {} hascuda: {} breakmodel: {} nobreakmode: {}".format(
                self.lazy_load,
                utils.koboldai_vars.hascuda,
                self.breakmodel,
                self.nobreakmodel,
            )
        )

        # If we're using torch_lazy_loader, we need to get breakmodel config
        # early so that it knows where to load the individual model tensors
        if (
            self.lazy_load
            and utils.koboldai_vars.hascuda
            and utils.koboldai_vars.breakmodel
            and not utils.koboldai_vars.nobreakmodel
        ):
            self.breakmodel_device_config(self.model_config)

        if self.lazy_load:
            # torch_lazy_loader.py and low_cpu_mem_usage can't be used at the same time
            tf_kwargs.pop("low_cpu_mem_usage", None)

            # If we're using lazy loader, we need to figure out what the model's hidden layers are called
            with lazy_loader.use_lazy_load(dematerialized_modules=True):
                try:
                    metamodel = AutoModelForCausalLM.from_config(self.model_config)
                    utils.layers_module_names = utils.get_layers_module_names(metamodel)
                    utils.module_names = list(metamodel.state_dict().keys())
                    utils.named_buffers = list(metamodel.named_buffers(recurse=True))
                except Exception as e:
                    if utils.args.panic:
                        raise e
                    logger.warning(f"Gave up on lazy loading due to {e}")
                    self.lazy_load = False

        # Download model from Huggingface if it does not exist, otherwise load locally
        if self.get_local_model_path():
            # Model is stored locally, load it.
            self.model = self._get_model(self.get_local_model_path(), tf_kwargs)
            self.tokenizer = self._get_tokenizer(self.get_local_model_path())
        else:
            # Model not stored locally, we need to download it.

            # _rebuild_tensor patch for casting dtype and supporting LazyTensors
            old_rebuild_tensor = torch._utils._rebuild_tensor

            def new_rebuild_tensor(
                storage: Union[lazy_loader.LazyTensor, torch.Storage],
                storage_offset,
                shape,
                stride,
            ):
                if not isinstance(storage, lazy_loader.LazyTensor):
                    dtype = storage.dtype
                else:
                    dtype = storage.storage_type.dtype
                    if not isinstance(dtype, torch.dtype):
                        dtype = storage.storage_type(0).dtype
                if dtype is torch.float32 and len(shape) >= 2:
                    utils.koboldai_vars.fp32_model = True
                return old_rebuild_tensor(storage, storage_offset, shape, stride)

            torch._utils._rebuild_tensor = new_rebuild_tensor
            self.model = self._get_model(self.model_name, tf_kwargs)
            self.tokenizer = self._get_tokenizer(self.model_name)
            torch._utils._rebuild_tensor = old_rebuild_tensor

            if save_model:
                self.tokenizer.save_pretrained(
                    self.get_local_model_path(ignore_existance=True)
                )

                if utils.koboldai_vars.fp32_model:
                    # Use save_pretrained to convert fp32 models to fp16,
                    # unless we are using disk cache because save_pretrained
                    # is not supported in that case
                    self.model = self.model.half()
                    self.model.save_pretrained(
                        self.get_local_model_path(ignore_existance=True),
                        max_shard_size="500MiB",
                    )

                else:
                    # For fp16 models, we can just copy the model files directly
                    import transformers.configuration_utils
                    import transformers.modeling_utils
                    import transformers.file_utils
                    import huggingface_hub

                    # Save the config.json
                    shutil.move(
                        os.path.realpath(
                            huggingface_hub.hf_hub_download(
                                self.model_name,
                                transformers.configuration_utils.CONFIG_NAME,
                                revision=utils.koboldai_vars.revision,
                                cache_dir="cache",
                                local_files_only=True,
                                legacy_cache_layout=False,
                            )
                        ),
                        os.path.join(
                            self.get_local_model_path(ignore_existance=True),
                            transformers.configuration_utils.CONFIG_NAME,
                        ),
                    )

                    if utils.num_shards is None:
                        # Save the pytorch_model.bin or model.safetensors of an unsharded model
                        any_success = False
                        possible_checkpoint_names = [
                            transformers.modeling_utils.WEIGHTS_NAME,
                            "model.safetensors",
                        ]

                        for possible_checkpoint_name in possible_checkpoint_names:
                            try:
                                shutil.move(
                                    os.path.realpath(
                                        huggingface_hub.hf_hub_download(
                                            self.model_name,
                                            possible_checkpoint_name,
                                            revision=utils.koboldai_vars.revision,
                                            cache_dir="cache",
                                            local_files_only=True,
                                            legacy_cache_layout=False,
                                        )
                                    ),
                                    os.path.join(
                                        self.get_local_model_path(
                                            ignore_existance=True
                                        ),
                                        possible_checkpoint_name,
                                    ),
                                )
                                any_success = True
                            except Exception:
                                pass

                        if not any_success:
                            raise RuntimeError(
                                f"Couldn't find any of {possible_checkpoint_names} in cache for {self.model_name} @ '{utils.koboldai_vars.revisison}'"
                            )
                    else:
                        # Handle saving sharded models

                        with open(utils.from_pretrained_index_filename) as f:
                            map_data = json.load(f)
                        filenames = set(map_data["weight_map"].values())
                        # Save the pytorch_model.bin.index.json of a sharded model
                        shutil.move(
                            os.path.realpath(utils.from_pretrained_index_filename),
                            os.path.join(
                                self.get_local_model_path(ignore_existance=True),
                                transformers.modeling_utils.WEIGHTS_INDEX_NAME,
                            ),
                        )
                        # Then save the pytorch_model-#####-of-#####.bin files
                        for filename in filenames:
                            shutil.move(
                                os.path.realpath(
                                    huggingface_hub.hf_hub_download(
                                        self.model_name,
                                        filename,
                                        revision=utils.koboldai_vars.revision,
                                        cache_dir="cache",
                                        local_files_only=True,
                                        legacy_cache_layout=False,
                                    )
                                ),
                                os.path.join(
                                    self.get_local_model_path(ignore_existance=True),
                                    filename,
                                ),
                            )
                shutil.rmtree("cache/")

        self.patch_embedding()

        self.model.kai_model = self
        utils.koboldai_vars.modeldim = self.get_hidden_size()

    def _save_settings(self):
        with open(
            "settings/{}.generic_hf_torch.model_backend.settings".format(
                self.model_name.replace("/", "_")
            ),
            "w",
        ) as f:
            json.dump(
                {
                    "layers": self.layers if "layers" in vars(self) else [],
                    "disk_layers": self.disk_layers
                    if "disk_layers" in vars(self)
                    else 0,
                },
                f,
                indent="",
            )
