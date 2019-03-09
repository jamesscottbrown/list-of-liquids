List of Liquids
=======================

A graphical interface for writing laboratory protocols.

[Pre-print of paper describing this system](https://www.biorxiv.org/content/early/2017/11/30/226852).

[Project homepage](http://sysos.eng.ox.ac.uk/tebio/protocols)
[Demo installation](http://protocols.jamesscottbrown.com/)


Other documentation:

-   Documentation for [autoprotocol python library](<https://autoprotocol-python.readthedocs.io/en/latest/protocol.html>)
-   [Specification for Autoprotocol](<http://autoprotocol.org/specification/>)
-   [OpenTrons API](<http://docs.opentrons.com>)
-   [OpenTrons example protocol library](<https://protocols.opentrons.com/>)


## Getting started

### With Docker

The simplest way to run List of Liquids is to [install Docker](https://docs.docker.com/install/) and [Docker compose](https://docs.docker.com/compose/install/), and clone this repository.

At the terminal, change directory into the cloned repository, and run:

    docker-compose build
    docker-compose up

You will then be able to use List of Liquids by opening the URL `http://localhost:5000/` in your web-browser.

Alternative, to run in devleopment mode, run:

    docker-compose -f docker-compose.dev.yml build
    docker-compose -f docker-compose.dev.yml up

Note that by default data is be saved to an SQLite database file inside the Docker container (`/code/dev.db` or `/code/prod.db`), so will be lost if this container is stopped or restarted. To persist data, use a volume.


### Without Docker

Clone the repository and install required python packages:

    git clone https://github.com/jamesscottbrown/protocol_gui
    cd protocol_gui
    pip install -r requirements/dev.txt


Before running shell commands, set the `FLASK_APP` and `FLASK_DEBUG`
environment variables :

    export FLASK_APP=/path/to/autoapp.py
    export FLASK_DEBUG=1


Run the following to create your app's database tables and perform the initial migration :

    flask db init
    flask db migrate
    flask db upgrade
    
You can now run the application:

    flask run

You can also pen an interactive shell by running :

    flask shell


### Deployment
If running in production, you will need to set a secret key to prevent sessions from being trivially steal-able.

To do this, set the ``PROTOCOL_GUI_SECRET`` environment variable. 
For example, add the following to `.bashrc` or `.bash_profile`:

``` {.sourceCode .bash}
export PROTOCOL_GUI_SECRET='something-really-secret'
```
You will also want to ensure the `FLASK_DEBUG` environment variable is unset or is set to `0`, so that `ProdConfig` is used.




Migrations
----------

Whenever a database migration needs to be made, first generate a new migration script :

    flask db migrate

And then apply it :

    flask db upgrade

For a full migration command reference, run `flask db --help`.
