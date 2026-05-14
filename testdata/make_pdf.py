from pathlib import Path

out_path = Path(r"C:\\ai interview\\testdata\\resume.pdf")
out_path.parent.mkdir(parents=True, exist_ok=True)

stream = b"BT\n/F1 24 Tf\n72 72 Td\n(Hello Resume) Tj\nET\n"
obj4 = b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)
objects = [
    (1, b"<< /Type /Catalog /Pages 2 0 R >>"),
    (2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    (3, b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"),
    (4, obj4),
    (5, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
]

out = b"%PDF-1.4\n"
offsets = []
for num, body in objects:
    offsets.append(len(out))
    out += f"{num} 0 obj\n".encode()
    out += body + b"\nendobj\n"

xref_offset = len(out)
out += f"xref\n0 {len(objects)+1}\n".encode()
out += b"0000000000 65535 f \n"
for off in offsets:
    out += f"{off:010d} 00000 n \n".encode()

out += f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\n".encode()
out += f"startxref\n{xref_offset}\n%%EOF\n".encode()

out_path.write_bytes(out)
print(str(out_path))
print("size", out_path.stat().st_size)
