FROM python:3.11-slim

WORKDIR /app

# CPU-only torch keeps the image a few hundred MB instead of several GB.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# One worker per container; scale by adding containers, not workers
# (each worker would load its own copy of the embedding model).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
