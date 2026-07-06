from __future__ import annotations

import warnings


warnings.filterwarnings(
    "ignore",
    message=r"urllib3 .* doesn't match a supported version!",
    module=r"requests(\..*)?",
)
