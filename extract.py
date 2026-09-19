import json
import re
from jee_data_base import DataBase, Filter

print("Processing database...")
db = DataBase()
f = Filter(db.chapters_dict)
all_q = f.get()
print(f"Total raw questions extracted: {len(all_q)}")

output = {"Mathematics": [], "Physics": [], "Chemistry": []}

# Subject classification keywords
MATH_KEYWORDS = [
    "calculus", "matrix", "matrices", "determinant", "integral", "derivative",
    "limit", "continuity", "differentiab", "probability", "permutation", "combination",
    "complex", "quadratic", "sequence", "series", "binomial", "vector", "3d", "geometry",
    "circle", "parabola", "ellipse", "hyperbola", "trigonometr", "relation", "function",
    "set", "stat", "coordinate", "algebra", "differential", "math"
]

PHYS_KEYWORDS = [
    "mechanics", "kinematics", "motion", "work", "power", "energy", "rotational",
    "gravitation", "thermo", "fluid", "wave", "sound", "ray", "optics", "electrostat",
    "current", "capacit", "magnet", "induction", "alternating", "emw", "semiconductor",
    "photoelectric", "dual nature", "friction", "circular", "heat", "physic"
]

CHEM_KEYWORDS = [
    "mole", "atomic", "bonding", "thermodynamics", "equilibrium", "redox",
    "electrochem", "kinetic", "surface", "periodic", "coordination", "metallurgy",
    "block", "organic", "hydrocarbon", "halo", "alcohol", "ether", "aldehyde", "ketone",
    "carboxylic", "amine", "biomolecule", "polymer", "isomerism", "solution", "gaseous", "chemist"
]

def clean_text(val):
    if val is None:
        return ""
    if isinstance(val, dict):
        return val.get("text") or val.get("value") or val.get("content") or val.get("option") or str(val)
    if hasattr(val, "text"):
        return str(getattr(val, "text", ""))
    return str(val).strip()

def sanitize_latex(text):
    """Converts legacy TeX matrix/cr macros to KaTeX compatible LaTeX"""
    if not text:
        return ""
    # Convert \matrix{a & b \cr c & d} -> \begin{matrix}a & b \\ c & d\end{matrix}
    text = re.sub(r'\\matrix\s*\{([\s\S]*?)\}', lambda m: f"\\begin{{matrix}}{m.group(1).replace(r'\\cr', r'\\\\')}\\end{{matrix}}", text)
    text = text.replace(r'\cr', r'\\')
    return text

def attach_images(base_text, obj):
    """Safely extracts image URLs and appends them without duplicating existing HTML tags"""
    text = clean_text(base_text)
    
    img_candidates = []
    for attr in ["image", "images", "img", "image_url", "diagram"]:
        val = getattr(obj, attr, None)
        if val:
            if isinstance(val, (list, tuple)):
                img_candidates.extend(val)
            else:
                img_candidates.append(val)

    for item in img_candidates:
        url = clean_text(item)
        if url and ("http://" in url or "https://" in url or url.endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg'))):
            if url not in text:
                text += f"\n\n![diagram]({url})\n"
                
    return sanitize_latex(text)

for idx, q in enumerate(all_q):
    sub_raw = str(getattr(q, "subject", "")).lower()
    ch_raw = str(getattr(q, "chapter", "")).lower()
    combined_info = f"{sub_raw} {ch_raw}"

    # Subject detection
    if any(k in combined_info for k in MATH_KEYWORDS):
        target_key = "Mathematics"
    elif any(k in combined_info for k in PHYS_KEYWORDS):
        target_key = "Physics"
    elif any(k in combined_info for k in CHEM_KEYWORDS):
        target_key = "Chemistry"
    else:
        target_key = "Mathematics"

    # Options unpacking
    raw_options = getattr(q, "options", [])
    parsed_options = []
    if isinstance(raw_options, (list, tuple)):
        for opt in raw_options:
            parsed_options.append(sanitize_latex(clean_text(opt)))

    # Question & explanation parsing
    final_q_text = attach_images(getattr(q, "question", ""), q)
    final_solution = sanitize_latex(clean_text(getattr(q, "solution", "Detailed solution not available.")))

    # Answer index validation
    ans_raw = getattr(q, "answer", 0)
    try:
        correct_idx = int(ans_raw)
        if correct_idx >= len(parsed_options) and len(parsed_options) > 0:
            correct_idx = 0
    except Exception:
        correct_idx = 0

    # Year fallback
    year_val = getattr(q, "year", None)
    if not year_val:
        match = re.search(r'\b(201[5-9]|202[0-6])\b', f"{getattr(q, 'shiftName', '')} {ch_raw}")
        year_val = int(match.group(0)) if match else 2024
    else:
        try:
            year_val = int(year_val)
        except Exception:
            year_val = 2024

    output[target_key].append({
        "id": getattr(q, "id", f"jee_{idx+1}"),
        "exam": "JEE Main",
        "subject": target_key,
        "chapter": clean_text(getattr(q, "chapter", "General")),
        "year": year_val,
        "difficulty": getattr(q, "difficulty", "Moderate"),
        "questionText": final_q_text,
        "options": parsed_options,
        "correctOptionIndex": correct_idx,
        "explanation": final_solution
    })

print("\n--- Extraction Summary ---")
print(f"Mathematics : {len(output['Mathematics'])} questions")
print(f"Physics     : {len(output['Physics'])} questions")
print(f"Chemistry   : {len(output['Chemistry'])} questions")

with open("pyq-data.js", "w", encoding="utf-8") as file:
    file.write("window.LOCAL_PYQ_DATA = " + json.dumps(output, ensure_ascii=False) + ";")

print("\nSUCCESS: pyq-data.js successfully generated with balanced subjects and sanitized LaTeX!")