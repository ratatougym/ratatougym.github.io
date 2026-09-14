"""Exercise the real Sphinx configuration without editing project docstrings."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class DocstringBuildTest(unittest.TestCase):
    def test_docstring_updates_keep_home_and_docs_separate(self):
        with tempfile.TemporaryDirectory(prefix="ratatougym-docstrings-") as tmp:
            source = Path(tmp) / "source"
            source.mkdir()
            output = Path(tmp) / "html"
            for name in ("_templates", "_themes", "_static"):
                (source / name).symlink_to(ROOT / name, target_is_directory=True)
            # Reuse the actual configuration, but avoid copying the large media bundle.
            (source / "conf.py").write_text(
                (ROOT / "conf.py").read_text() + "\nhtml_static_path = []\n",
                encoding="utf-8",
            )
            (source / "index.rst").write_text(
                "Home\n====\n\n.. toctree::\n   :hidden:\n\n   overview\n",
                encoding="utf-8",
            )
            (source / "overview.rst").write_text(
                "Documentation\n=============\n\n.. automodule:: autodoc_probe\n   :members:\n",
                encoding="utf-8",
            )
            env = {**os.environ, "RTGYM_SOURCE": str(source)}
            for marker in ("OriginalDocstringProbe", "UpdatedDocstringProbeLonger"):
                (source / "autodoc_probe.py").write_text(
                    f'def encode(value):\n    """{marker}."""\n    return value\n',
                    encoding="utf-8",
                )
                shutil.rmtree(source / "__pycache__", ignore_errors=True)
                result = subprocess.run(
                    ["sphinx-build", "-b", "html", "-E", str(source), str(output)],
                    env=env, capture_output=True, text=True, timeout=120,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                docs = (output / "overview.html").read_text()
                self.assertIn(marker, docs)
                self.assertIn('id="autodoc_probe.encode"', docs)
                self.assertIn('class="docs-page"', docs)
                self.assertIn("scene-docs.css", docs)
                self.assertIn('_modules/autodoc_probe.html#encode', docs)
                self.assertNotIn('id="gallery"', docs)
                home = (output / "index.html").read_text()
                self.assertIn('id="gallery"', home)
                self.assertIn('href="overview.html"', home)
                self.assertNotIn(marker, home)
            self.assertNotIn("OriginalDocstringProbe", docs)


if __name__ == "__main__":
    unittest.main()
