FROM python:3.11-slim

WORKDIR /app

# Install the CPU-only build of torch first. The default PyPI wheel pulls in
# CUDA libraries even on machines with no GPU -- that's most of the multi-GB
# size problem. This brings it down to a few hundred MB instead of 2-3GB.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "lesson1_embeddings.py"]
