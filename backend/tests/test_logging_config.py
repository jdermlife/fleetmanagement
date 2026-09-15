import logging

from logging_config import StructuredLogger


def test_structured_logger_exception_includes_traceback(caplog):
    logger = StructuredLogger("test.structured.exception")

    with caplog.at_level(logging.ERROR, logger="test.structured.exception"):
        try:
            raise RuntimeError("database write failed")
        except RuntimeError:
            logger.exception("Unhandled request exception", path="/api/test")

    assert "Unhandled request exception" in caplog.text
    assert '"path": "/api/test"' in caplog.text
    assert "RuntimeError: database write failed" in caplog.text