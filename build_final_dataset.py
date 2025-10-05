#!/usr/bin/env python3
import re
import sys
import time
import json

# --- CONFIGURATION ---
# Input files you have already created
TRANSLITERATION_FILE = "rigveda_samhita_transliteration.txt"
TRANSLATION_FILE = "rigveda_translation_griffith_CLEAN.txt"

# The final output file for your app
OUTPUT_JSON_FILE = "rigveda_data.json"

# Source URL for Devanagari text
DEVANAGARI_BASE_URL = "https://sanskritdocuments.org/doc_veda/r{}.html"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}
# --- END CONFIGURATION ---

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("[ERROR] Required libraries not installed. Run: pip install requests beautifulsoup4")
    sys.exit(1)

def parse_verse_id(verse_id_str):
    """Parses 'RV_01,001.01a' into a tuple (1, 1, 1)."""
    match = re.match(r"RV_(\d+),(\d+)\.(\d+)", verse_id_str)
    if match:
        return int(match.group(1)), int(match.group(2)), int(match.group(3))
    return None

def main():
    """
    Main function to build the complete, structured Rigveda JSON dataset.
    """
    print(">>> STEP 1 of 3: Loading and processing Transliteration file...")
    transliterations = {}
    try:
        with open(TRANSLITERATION_FILE, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(" ", 1)
                if len(parts) < 2:
                    continue
                verse_id_str, text = parts
                verse_id = parse_verse_id(verse_id_str)
                if verse_id:
                    # Append parts of the same verse (like 'a' and 'c')
                    transliterations[verse_id] = transliterations.get(verse_id, "") + text + " "
    except FileNotFoundError:
        print(f"[FATAL] Transliteration file not found: {TRANSLITERATION_FILE}")
        sys.exit(1)
    print(f"[SUCCESS] Processed {len(transliterations)} unique transliterated verses.")


    print("\n>>> STEP 2 of 3: Loading and processing clean Translation file...")
    translations = [
        line.split('.', 1)[1].strip()
        for line in open(TRANSLATION_FILE, "r", encoding="utf-8")
        if re.match(r"^\d+\.", line.strip())
    ]
    print(f"[SUCCESS] Processed {len(translations)} translated verses.")


    print("\n>>> STEP 3 of 3: Fetching and processing Devanagari text...")
    devanagari_data = []
    # Dictionary to convert Devanagari numerals to standard integers
    numeral_map = str.maketrans("०१२३४५६७८९", "0123456789")

    for i in range(1, 11):
        mandala_id_str = str(i).zfill(2)
        url = DEVANAGARI_BASE_URL.format(mandala_id_str)
        print(f"[*] Fetching Mandala {i} from {url}...")
        
        try:
            response = requests.get(url, headers=HEADERS, timeout=30)
            response.raise_for_status()
            response.encoding = 'utf-8'
            
            soup = BeautifulSoup(response.text, "html.parser")
            content_pre = soup.find('pre', id='content')
            
            if not content_pre:
                print(f"    [WARNING] Could not find content for Mandala {i}. Skipping.")
                continue

            # Regex to capture two lines ending with the verse number.
            pattern = re.compile(r"(.*?)\n(.*?)\s*॥\s*([\d.०१२३४५६७८९]+)", re.MULTILINE)
            
            for match in pattern.finditer(content_pre.get_text()):
                line1 = match.group(1).strip()
                line2 = match.group(2).strip()
                verse_num_str = match.group(3).strip()
                
                # Combine verse lines and translate numerals
                full_verse = f"{line1} {line2} ॥"
                verse_num_str_eng = verse_num_str.translate(numeral_map)
                
                # Parse the verse ID (e.g., "1.001.01")
                num_parts = verse_num_str_eng.split('.')
                if len(num_parts) == 3:
                    m, s, v = int(num_parts[0]), int(num_parts[1]), int(num_parts[2])
                    verse_id = (m, s, v)
                    devanagari_data.append({"id": verse_id, "devanagari": full_verse})

        except Exception as e:
            print(f"[FATAL ERROR] Failed while processing Mandala {i}. Error: {e}")
            sys.exit(1)
        
        time.sleep(1) # Be polite
    
    print(f"[SUCCESS] Processed {len(devanagari_data)} Devanagari verses.")


    # --- FINAL MERGE ---
    print("\n>>> Merging all data sources...")
    final_dataset = []
    translation_idx = 0
    # Create a dictionary for faster lookups
    deva_dict = {item["id"]: item["devanagari"] for item in devanagari_data}

    for verse_id, translit_text in transliterations.items():
        mandala, sukta, verse = verse_id
        
        deva_text = deva_dict.get(verse_id, "Devanagari not found")
        transla_text = translations[translation_idx] if translation_idx < len(translations) else "Translation not found"
        
        final_dataset.append({
            "mandala": mandala,
            "sukta": sukta,
            "verse": verse,
            "devanagari": deva_text,
            "transliteration": translit_text.strip(),
            "translation_griffith": transla_text
        })
        translation_idx += 1

    # Write the final JSON output file
    with open(OUTPUT_JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(final_dataset, f, ensure_ascii=False, indent=2)

    print("\n" + "="*50)
    print(">>>      HACKATHON DATASET COMPLETE!      <<<")
    print("="*50)
    print(f"\n    Final merged data has been saved to '{OUTPUT_JSON_FILE}'.")
    print("    You are now ready to build your application!")
    print("\n" + "="*50)

if __name__ == "__main__":
    main()