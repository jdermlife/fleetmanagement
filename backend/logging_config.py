import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any


class StructuredLogger:
    def __init__(self, name: str, level: int = logging.INFO):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(logging.Formatter(
                '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "name": "%(name)s", "message": %(message)s}'
            ))
            self.logger.addHandler(handler)

    def _format(self, message: str, **kwargs) -> str:
        base = {"timestamp": datetime.now(timezone.utc).isoformat(), "message": message}
        base.update(kwargs)
        return str(base).replace("'", '"')

    def info(self, message: str, **kwargs):
        self.logger.info(self._format(message, **kwargs))

    def warning(self, message: str, **kwargs):
        self.logger.warning(self._format(message, **kwargs))

    def error(self, message: str, **kwargs):
        self.logger.error(self._format(message, **kwargs))

    def debug(self, message: str, **kwargs):
        self.logger.debug(self._format(message, **kwargs))


request_logger = StructuredLogger("fleet.request")
audit_logger = StructuredLogger("fleet.audit", level=int(os.getenv("AUDIT_LOG_LEVEL", logging.INFO)))
security_logger = StructuredLogger("fleet.security")