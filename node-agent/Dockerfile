FROM python:3.12-slim

WORKDIR /app

COPY agent.py .

RUN pip install requests

CMD ["python", "agent.py"]
