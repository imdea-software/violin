# Monitoring Refinement via Symbolic Reasoning

This project aims to develop efficient monitoring algorithms for concurrent
data structures, e.g., locks, semaphores, atomic registers, stacks, queues.


## Installation

This project is written in [Ruby], and works “out of the box” without
compilation nor installation, though does require a Ruby interpreter. Simply
clone this repository, configure accordingly, and proceed to *Usage*
instructions.

    git clone https://github.com/imdea-software/observational-refinement-checking.git

Below we provide instructions for configuration with your native Ruby
installation, as well as alternative instructions for using a preconfigured
virtual environment.


### Configuration with Native Ruby Installation

In principle, this project works “out of the box” with the latest Ruby
interpreters an a couple of supplementary “gems”. So is our experience with OS
X and Linux, though we have not tested on Windows.

#### Requirements

* [Ruby], version 2.0.0 or greater.
* The `ffi` and `os` Ruby gems, installed via `gem install ffi os`.

**Note** This project also uses [Z3] as a shared library. For convenience we
provide the [Z3] shared library prebuilt for 64bit OS X (Yosemite), 64bit Linux
(OpenSUSE), and Windows in the `xxx/` directory. Dependence on the platforms on
which it was built is unclear. In the case that you encounter problems
involving `FFI` or `Z3`, try to obtain [Z3] on your own, and include the
appropriate `libz3.{dylib,so,dll}` in your `LIBRARY_PATH`.


### Preconfigured Virtual Environment

Alternatively, this project can be run in a preconfigured virtual machine using
[VirtualBox] and [Vagrant]. Both are available for a wide range of systems,
with great installation support.

#### Requirements

* [VirtualBox], version 4.3.20 or greater
* [Vagrant], version 1.7.2 or greater

#### Instructions

First, start [Vagrant] in this project’s root directory (containing
`Vagrantfile`):

    vagrant up

This can take a few minutes the first time around, since it includes the
download of a virtual machine image. When this step finishes, our virtual
machine should be up and running — verify this with the `vagrant status`
command. Open a shell to the running virtual machine via ssh:

    vagrant ssh

and follow the *Usage* instructions below. When finished, simply close the SSH
session, and halt, suspend, or destroy the virtual machine:

    vagrant destroy


## Contents

Files in this project are organized according to the following directory
structure.

* `bin/` contains executable ruby programs:
    * `logchecker.rb` for checking history logs,
    * `loggenerator.rb` for generating history logs,
    * `report.rb` for generating benchmarking reports, and
    * `experiments.rb` for generating experimental data.

* `data/` contains various data:
    * `histories/` contains history logs,
        * `generated/` contains history logs generated from actual executions,
        * `simple/` contains hand-crafted history logs,
    * `reports/` contains reports benchmarking the performance of each algorithm,
    * `experiments/` contains empirical measurements, and
    * `plots/` contains visualizations of empirical measurements.

* `lib/` contains the source code of the checking algorithms.

* `pldi-2015-submission.pdf` is a research paper accepted to [PLDI 2015][].

* `xxx/` contains prebuilt external shared-libraries for OS X, Windows, and Linux.


## Usage

The `logchecker.rb` program checks whether an input history violates it’s
corresponding object specification, via one of various algorithms. This program
is invoked as follows:

    ./bin/logchecker.rb data/histories/simple/lifo-violation-dhk-2.log -a symbolic -v

This command runs the “symbolic” checking algorithm on the
`lifo-violation-dhk-2.log` history. See *History Input Format*, below, for a
description of the input format to `logchecker.rb`.

To see the list of options to `logchecker.rb`, run

    ./bin/logchecker.rb --help

An input history file is mandatory. The checking algorithm is given by the
option `-a`/`--algorithm`. Valid choices include `enumerate`, `symbolic`,
`saturate`, and `counting`.

When the “enumerate” and “symbolic” algorithms are used, the
`-c`/`--[no-]completion` flag enables/disables the enumeration of history
completions prior to the enumeration of linearizations. When the “symbolic”
algorithm is used, the `-i`/`--[no-]incremental` flag enables/disables
incremental assertions to the underlying theorem prover. For all algorithms,
the `-r`/`--[no-]remove-obsolete` flag performs the match-removal optimization
to remove operations deemed obsolete.

When the “counting” algorithm is used, the interval bound is specified via the
`-b`/`--interval-bound` option — see [Tractable Refinement Checking for
Concurrent Objects][popl-2015-paper] for background on approximating refinement
checking via interval bounding.


### Generating History Logs

The `loggenerator.rb` program was used to generate the history logs in the
`histories/generated` directory by pseudo-random execution of various objects
from the [Scal] High-Performance Multicore-Scalable Computing suite. This
program depends on an external library which is not currently included in this
project, and is thus currently unusable. However, any available means of
generating valid history log files, or simply using the pre-recorded histories
in the `data/histories` directory, is compatible with the `logchecker.rb`
program.


### Benchmarking Reports

To generate reports benchmarking the performance of various algorithms with
various parameters on the many history logs included in this project, run

    ./bin/report.rb

The rightmost column `v` indicates whether a violation was discovered in the
given history by the given algorithm: `√` indicates “yes”, and `-` no. In case
the given algorithm exceeds the given timeout, the value in the `steps` and
`time` columns are marked with an asterisk. The default timeout is 5 seconds,
and is adjustable via the `--timeout` option. To see the list of options to
`report.rb`, run

    ./bin/report.rb --help

Previous runs of `report.rb` are logged in the `data/reports` directory.


### Empirical Data

The empirical data used in the publication of this work is generated via the
`experiments.rb` program. Results are stored in tab-separated-values (TSV)
format in the `data/experiments` directory. Visualizations of this data are
stored in the `data/plots` directory. The file `data/plots/plot.html` renders
the data in a web browser, and is known to work with Safari.


## History Input Format

The input to the history-checking algorithms is a text file specifying the
execution history of an object via ordered method call and return actions. Each
action must appear on a separate line. Call actions have the format

    [ID] call MMM(V1, V2, …)

where `ID` is an operation identifier, `MMM` is a method name, and `V1`, `V2`,
… is a possibly-empty sequence of argument values. Return actions have the
format

    [ID] return V1, V2, …

where `ID` is an operation identifier, and `V1`, `V2`, … is a possibly-empty
sequence of return values. Each operation identifier may appear in at most 2
actions — one call and one return — and each identifiers appearing in a return
action must appear in some prior call action. Lines beginning with `#` are
ignored. For example, the following the history

    [1] call push(a)
    [2] call push(b)
    [2] return
    [3] call pop
    [3] return a
    
is the concurrent history of a stack data structure, where the values `a` and
`b` are pushed concurrently — operations `1` and `2` overlap — and the value
`a` is popped while operation `1` is still pending — the return action of
operation `1` has not occurred. Drawn as intervals spanned by the `#` symbol,
this corresponds to the history

    [1] push(a)*  ###
    [2] push(b)   #
    [3] pop => a    #

where the `*` symbol indicates that operation `1` is pending.

The directory `data/histories` contains many other example histories.

**Note** currently only support for atomic stack-based and queue-based
collections has been implemented. To support additional classes of objects,
their logical theories and matching functions must be added to
`lib/theories.rb` and `lib/matching.rb`.

**Note** currently we assume that each history contains one of the following lines:

    # @object atomic-stack
    # @object atomic-queue

and uses only one of the following method name pairs: `add`/`rem`, `put`/`get`,
`push`/`pop`, `enqueue`/`dequeue`. When in doubt, just follow the examples
contained in `data/histories`.


[Ruby]: https://www.ruby-lang.org
[RubyInstaller]: http://rubyinstaller.org
[Homebrew]: http://brew.sh
[Cygwin]: https://www.cygwin.com
[libffi]: https://sourceware.org/libffi
[Z3]: http://z3.codeplex.com

[Vagrant]: https://www.vagrantup.com
[VirtualBox]: https://www.virtualbox.org

[PLDI 2015]: http://conf.researchr.org/home/pldi2015

[popl-2015-paper]: http://michael-emmi.github.io/papers/conf-popl-BouajjaniEEH15.pdf

[Scal]: http://scal.cs.uni-salzburg.at
