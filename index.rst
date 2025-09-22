.. RatatouGym documentation master file, created by
   sphinx-quickstart on Fri Sep 12 11:43:15 2025.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to RatatouGym's documentation!
=====================================

Introduction
------------

RatatouGym is a gymnasium environment for simulating spatial navigation in brains. It offers a comprehensive yet simple interface that integrates the simulation of environmental geometries, multiple sensory systems (modeled through their firing tunings), and diverse spatial traversal behaviors (such as random exploration with boundary avoidance).

Project
-------
The RatatouGym source code is available at `RatatouGym <https://github.com/RatatouGym/rtgym>`_. For more details of how to use or install the project, please refer to the section :doc:`installation`.

Citation
--------

If you use RatatouGym in your research, please cite:

.. code-block:: bibtex

   @inproceedings{WangTimeMakesSpace2024,
      title = {Time Makes Space: Emergence of Place Fields in Networks Encoding Temporally Continuous Sensory Experiences},
      author = {Wang, Zhaoze and Di Tullio, Ronald W. and Rooke, Spencer and Balasubramanian, Vijay},
      booktitle = {Advances in Neural Information Processing Systems (NeurIPS)},
      year = {2024},
      url= {https://arxiv.org/abs/2408.05798}
   }

   @inproceedings{WangREMI2025,
      title = {REMI: REconstructing Memory During Intrinsic Path Planning},
      author = {Wang, Zhaoze and Morris, Genela and Derdikman, Dori and Chaudhari, Pratik and Balasubramanian, Vijay},
      booktitle = {Advances in Neural Information Processing Systems (NeurIPS)},
      year = {2025},
      url = {https://arxiv.org/abs/2507.02064},
      eprint = {arXiv:2507.02064}
   }


.. toctree::
   :maxdepth: 2
   :caption: Getting Started:

   introduction
   installation
   getting_started

.. toctree::
   :maxdepth: 2
   :caption: API Reference:

   rtgym
   rtgym.agent
   rtgym.arena
   rtgym.dataclass
   rtgym.utils


License
-------
RatatouGym is released under the MIT License. See the `LICENSE <https://github.com/RatatouGym/rtgym/blob/main/LICENSE>`_ file for details.