"""Logging configuration for Smart Hospital Resource Allocation System."""
import logging
import os


def setup_logger(log_dir: str = "logs") -> logging.Logger:
    """Configures application logger to write to console and rotating log file."""
    os.makedirs(log_dir, exist_ok=True)
    logger = logging.getLogger("SmartHospital")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        c_handler = logging.StreamHandler()
        c_format = logging.Formatter("[%(asctime)s] %(levelname)s - %(message)s", datefmt="%H:%M:%S")
        c_handler.setFormatter(c_format)
        logger.addHandler(c_handler)

        f_handler = logging.FileHandler(os.path.join(log_dir, "app.log"), encoding="utf-8")
        f_format = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        f_handler.setFormatter(f_format)
        logger.addHandler(f_handler)

    return logger
