#!/usr/bin/env python3
"""
Test runner for Fleet Management System with production security features.
Run with: python -m unittest discover -s tests -v
Or: python tests/run_tests.py
"""

import unittest
from pathlib import Path


def run_all_tests():
    loader = unittest.TestLoader()
    suite = loader.discover(Path(__file__).parent, pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    import sys
    sys.exit(run_all_tests())