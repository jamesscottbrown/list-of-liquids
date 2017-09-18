#Docker file for local building and serving only
FROM ubuntu:14.04
MAINTAINER James Scott-Brown <james@jamesscottbrown.com>

RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y python binutils g++ make sqlite3 python-pip

RUN pip install --upgrade pip

ADD . /code
WORKDIR /code
RUN pip install -r requirements/dev.txt

ENV FLASK_APP=/code/autoapp.py
ENV FLASK_DEBUG=1

CMD flask run --host=0.0.0.0
