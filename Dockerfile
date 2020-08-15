#Docker file for local building and serving only
FROM python
MAINTAINER James Scott-Brown <james@jamesscottbrown.com>

RUN apt-get update && apt-get install -y binutils g++ make sqlite3

ADD . /code
WORKDIR /code
RUN pip install -r requirements/dev.txt

# Initialize empty prod database
RUN export FLASK_APP=/code/autoapp.py && export FLASK_DEBUG=0 && flask db init && flask db migrate && flask db upgrade

ENV FLASK_APP=/code/autoapp.py
ENV FLASK_DEBUG=0

CMD flask run --host=0.0.0.0
