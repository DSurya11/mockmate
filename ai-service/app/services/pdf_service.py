import io
from PyPDF2 import PdfReader
from PyPDF2.errors import PdfReadError


def extract_text_from_pdf(file_bytes):
    try:
        reader = PdfReader(io.BytesIO(file_bytes))

        text = ""

        for page in reader.pages:
            text += page.extract_text() or ""

        return text

    except PdfReadError:
        raise ValueError("Invalid or corrupted PDF file")

    except Exception as e:
        raise ValueError(f"PDF parsing failed: {str(e)}")