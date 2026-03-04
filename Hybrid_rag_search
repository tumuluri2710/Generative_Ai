import os
import time
import hashlib
import pickle
from concurrent.futures import ThreadPoolExecutor

from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ==============================
# 1. CONFIGURATION
# ==============================

PDF_DIRECTORY = "D:\\Downloads\\NLTK_LEARNING\\mcp_test\\RAG\\data"
PERSIST_DIR = "./chroma_db"
BM25_PATH = "./bm25_index.pkl"

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
THREAD_WORKERS = 4

# ==============================
# 2. INITIALIZE MODELS
# ==============================

print("Initializing models...")

embeddings_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

reranker_model = CrossEncoder(
    "cross-encoder/ms-marco-MiniLM-L-6-v2"
)

# ==============================
# UTIL FUNCTIONS
# ==============================

def get_chunk_id(content: str) -> str:
    """Generate unique MD5 hash for chunk."""
    return hashlib.md5(content.encode()).hexdigest()


def process_file(file_path):
    """Thread worker: Load and split PDF."""
    try:
        loader = PyMuPDFLoader(file_path)
        documents = loader.load()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP
        )

        chunks = splitter.split_documents(documents)

        # Add metadata: file name only
        for chunk in chunks:
            chunk.metadata["source_file"] = os.path.basename(file_path)

        return chunks

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return []


# ==============================
# BM25 PERSISTENCE
# ==============================

def save_bm25(bm25, chunks):
    """Persist BM25 and chunks to disk."""
    with open(BM25_PATH, "wb") as f:
        pickle.dump((bm25, chunks), f)


def load_bm25():
    """Load BM25 if exists."""
    if os.path.exists(BM25_PATH):
        with open(BM25_PATH, "rb") as f:
            return pickle.load(f)
    return None, None


# ==============================
# INGESTION PIPELINE
# ==============================

def run_ingestion():
    start_time = time.perf_counter()

    pdf_files = [
        os.path.join(PDF_DIRECTORY, f)
        for f in os.listdir(PDF_DIRECTORY)
        if f.endswith(".pdf")
    ]

    if not pdf_files:
        print("No PDFs found.")
        return None, None, []

    print(f"Processing {len(pdf_files)} PDFs with threading...")

    with ThreadPoolExecutor(max_workers=THREAD_WORKERS) as executor:
        results = list(executor.map(process_file, pdf_files))

    all_chunks = [chunk for sublist in results for chunk in sublist]

    # ==============================
    # CHROMA VECTOR DB
    # ==============================

    vector_db = Chroma(
        persist_directory=PERSIST_DIR,
        embedding_function=embeddings_model
    )

    db_data_before = vector_db.get()
    existing_ids = set(db_data_before["ids"])
    count_before = len(existing_ids)

    new_chunks = []
    new_ids = []

    for chunk in all_chunks:
        c_id = get_chunk_id(chunk.page_content)

        if c_id not in existing_ids:
            new_chunks.append(chunk)
            new_ids.append(c_id)

    if new_chunks:
        print(f"Adding {len(new_chunks)} new chunks to Chroma...")
        vector_db.add_documents(new_chunks, ids=new_ids)
    else:
        print("No new chunks to add.")

    count_after = len(vector_db.get()["ids"])

    # ==============================
    # BM25 (Persistent)
    # ==============================

    existing_bm25, existing_chunks = load_bm25()

    if existing_bm25 and existing_chunks:
        print("Loaded existing BM25 index.")
        bm25 = existing_bm25
        chunks_for_bm25 = existing_chunks
    else:
        print("Building new BM25 index...")
        tokenized_corpus = [
            c.page_content.lower().split()
            for c in all_chunks
        ]
        bm25 = BM25Okapi(tokenized_corpus)
        chunks_for_bm25 = all_chunks
        save_bm25(bm25, chunks_for_bm25)

    duration = time.perf_counter() - start_time

    print("\n" + "=" * 50)
    print("INGESTION REPORT")
    print("=" * 50)
    print(f"DB Count Before : {count_before}")
    print(f"DB Count After  : {count_after}")
    print(f"New Added       : {count_after - count_before}")
    print(f"Time Taken      : {duration:.2f}s")
    print("=" * 50 + "\n")

    return vector_db, bm25, chunks_for_bm25


# ==============================
# HYBRID SEARCH WITH METADATA FILTER
# ==============================

def hybrid_rerank_search(
        query,
        vector_db,
        bm25,
        chunks,
        k=5,
        source_filter=None
):
    """
    Hybrid retrieval + reranking
    Optional metadata filtering by source file.
    """

    search_start = time.perf_counter()

    # -----------------------------------
    # 1. Metadata Filtering
    # -----------------------------------

    if source_filter:
        filtered_chunks = [
            c for c in chunks
            if c.metadata.get("source_file") == source_filter
        ]
    else:
        filtered_chunks = chunks

    if not filtered_chunks:
        return [], 0.0

    # -----------------------------------
    # 2. BM25 Retrieval
    # -----------------------------------

    tokenized_query = query.lower().split()
    bm25_hits = bm25.get_top_n(tokenized_query, filtered_chunks, n=k)

    # -----------------------------------
    # 3. Vector Search (with metadata filter)
    # -----------------------------------

    if source_filter:
        vector_hits = vector_db.similarity_search(
            query,
            k=k,
            filter={"source_file": source_filter}
        )
    else:
        vector_hits = vector_db.similarity_search(query, k=k)

    # -----------------------------------
    # 4. Deduplicate Candidates
    # -----------------------------------

    candidate_map = {
        get_chunk_id(c.page_content): c
        for c in (bm25_hits + vector_hits)
    }

    unique_candidates = list(candidate_map.values())

    # -----------------------------------
    # 5. CrossEncoder Reranking
    # -----------------------------------

    pairs = [[query, c.page_content] for c in unique_candidates]
    scores = reranker_model.predict(pairs)

    scored_results = sorted(
        zip(scores, unique_candidates),
        key=lambda x: x[0],
        reverse=True
    )

    search_duration = time.perf_counter() - search_start

    return scored_results[:k], search_duration


# ==============================
# MAIN
# ==============================

if __name__ == "__main__":

    if not os.path.exists(PDF_DIRECTORY):
        print("PDF directory not found.")
        exit()

    v_db, b_index, processed_chunks = run_ingestion()

    if v_db:

        query = "What is the value of d_model and number of heads?"

        # 🔹 Without metadata filter
        results, time_taken = hybrid_rerank_search(
            query,
            v_db,
            b_index,
            processed_chunks,
            k=5
        )

        print(f"\nSearch completed in {time_taken:.4f}s")

        if results:
            score, doc = results[0]
            print("\n--- TOP RESULT ---")
            print(f"Score: {score:.4f}")
            print(f"Source File: {doc.metadata.get('source_file')}")
            print("-" * 40)
            print(doc.page_content[:1000])

        # 🔹 Example with metadata filter
        # results, _ = hybrid_rerank_search(
        #     query,
        #     v_db,
        #     b_index,
        #     processed_chunks,
        #     k=5,
        #     source_filter="attention_is_all_you_need.pdf"
        # )
