import collections
from typing import Iterable, Tuple


class KoboldStoryRegister(collections.OrderedDict):
    """
    Complexity-optimized class for keeping track of story chunks
    """

    def __init__(self, sequence: Iterable[Tuple[int, str]] = ()):
        super().__init__(sequence)
        self.__next_id: int = sum(1 for _ in sequence)

    def append(self, v: str) -> None:
        self[self.__next_id] = v
        self.increment_id()
    
    def pop(self, **kwargs) -> str:
        return self.popitem()[1]
    
    @property
    def get_first_key(self) -> int:
        if len(self) == 0:
            return -1
        else:
            return next(iter(self))

    def get_last_key(self) -> int:
        if len(self) == 0:
            return -1
        else:
            return next(reversed(self))

    def __getitem__(self, k: int) -> str:
        return super().__getitem__(k)

    def __setitem__(self, k: int, v: str) -> None:
        return super().__setitem__(k, v)

    def increment_id(self) -> None:
        self.__next_id += 1

    def get_next_id(self) -> int:
        return self.__next_id

    def set_next_id(self, x: int) -> None:
        self.__next_id = x
