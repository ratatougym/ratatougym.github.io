Introduction
============

About the Project
-------------------

RatatouGym is a gymnasium environment for simulating spatial navigation in brains. It offers a comprehensive yet simple interface that integrates the simulation of environmental geometries, multiple sensory systems (modeled through their firing tunings), and diverse spatial traversal behaviors (such as random exploration with boundary avoidance).

Research Background
-------------------

Imagine how easily biological systems can navigate through different environments, indoors or outdoors, whether in a familiar place or somewhere new. Animals can remember and return to important locations, like a bird finding its nest or a rat locating stored food. And for us humans, we can recall where we left a key, the spot where we parked the car, or the way to a favorite restaurant, then plan a path to get there while recalling the scenes along the way almost effortlessly. In our own homes, we can even make it to the bathroom in the middle of the night, half asleep and in almost complete darkness.

Understanding how the brain represents space is not only a key question in neuroscience, it also inspires how we design artificial systems for mapping and planning. The discovery of specialized navigation cells, such as place cells and grid cells, gave us a glimpse of how the brain might build internal maps(`O'Keefe & Dostrovsky, 1971 <https://doi.org/10.1016/0006-8993(71)90358-1>`_, `Hafting et al., 2005 <https://doi.org/10.1038/nature03721>`_). Running real experiments, however, takes time, requires data from many animals, and often comes with noise that makes analysis difficult. One way around this is to use simulations: by training artificial neural networks in virtual environments, we can test different assumptions and see whether similar patterns to those found in biological systems emerge (`Sorscher et al., 2020 <https://www.biorxiv.org/content/10.1101/2020.12.29.424583v1.full>`_, `Cueva & Wei, 2018 <https://arxiv.org/abs/1803.07770>`_, `Banino et al., 2018 <https://www.nature.com/articles/s41586-018-0102-6>`_).

Why RatatouGym?
-------------

RatatouGym is a gymnasium environment built in this spirit. The idea is to view both brains and artificial neural networks as dynamical systems embedded within the world, where solving tasks naturally drives the formation of efficient and stable internal maps. Behaviors and representations are task driven, and the goal is to uncover the principles or task structures that shape them.

Testing different assumptions often requires reimplementing large parts of the setup. For instance, building new environments, defining upstream and downstream inputs/outputs, modeling the agent's behavior. Creating analysis pipelines such as decoding position or mapping activity often have to be rebuilt from scratch.

RatatouGym provides an integrated interface that brings these pieces together. It offers ready to use environments, flexible models of navigation related cells, and built in analysis tools. This reduces engineering overhead and allows researchers to focus on the scientific questions, testing assumptions, comparing outcomes, and moving toward a clearer understanding of navigation in biological and artificial systems.

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

License
-------
RatatouGym is released under the MIT License. See the `LICENSE <https://github.com/RatatouGym/rtgym/blob/main/LICENSE>`_ file for details.