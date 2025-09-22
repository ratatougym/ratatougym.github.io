Installation
============

Create a Virtual Environment
----------------------------

We recommend using conda to create a new environment:

.. code-block:: bash

   conda create -n rtgym python=3.10
   conda activate rtgym

Install the Package
-------------------

.. code-block:: bash

   git clone https://github.com/RatatouGym/rtgym.git
   cd rtgym
   pip install .

Dependency Installation
-----------------------

RatatouGym automatically installs these core dependencies via pip:

- **NumPy** (≥1.20.0): Numerical computing
- **Matplotlib** (≥3.3.0): Plotting and visualization
- **PyTorch** (≥1.10.0): Deep learning framework
- **SciPy** (≥1.7.0): Scientific computing
- **scikit-learn** (≥1.0.0): Machine learning utilities
- **FAISS** (≥1.7.0): Efficient similarity search and clustering
- **PyYAML** (≥5.4.0): YAML parsing and generation
- **IPython** (≥7.0.0): Enhanced interactive Python shell

Note:
For the faiss dependency, you may alternatively install `faiss-gpu` instead of `faiss-cpu`.


Getting Help
------------

If you encounter issues not covered here:

1. Check the `GitHub Issues <https://github.com/zhaozewang/rtgym/issues>`_
2. Create a new issue with:
   - Your operating system and Python version
   - Complete error messages
   - Steps to reproduce the problem
