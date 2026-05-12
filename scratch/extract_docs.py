import docx
import json
import os

files = [
    "HireAI Question Bank.docx",
    "HireAI Evaluation Matrices.docx",
    "HireAI Interviewer Component.docx"
]

results = {}

for file in files:
    try:
        doc = docx.Document(file)
        fullText = []
        for para in doc.paragraphs:
            fullText.append(para.text)
        results[file] = "\n".join(fullText)
    except Exception as e:
        results[file] = f"Error reading file: {str(e)}"

with open("extracted_text.json", "w") as f:
    json.dump(results, f, indent=4)

print("Extraction complete. Results saved to extracted_text.json")
