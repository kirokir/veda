#!/usr/bin/env python3
import re
import json

# --- Configuration ---
# The three source files we will merge
DEVANAGARI_FILE = "rigveda_samhita_mandalas_1-10_deva.txt"
TRANSLITERATION_FILE = "rigveda_samhita_transliteration.txt"
TRANSLATION_FILE = "rigveda_translation_griffith_CLEAN.txt"

# The final output file for your app
OUTPUT_JSON_FILE = "rigveda_data.json"
# --- End Configuration ---

def parse_verse_id(verse_id_str):
    """Parses 'RV_01,001.01a' into (1, 1, 1)."""
    match = re.match(r"RV_(\d+),(\d+)\.(\d+)", verse_id_str)
    if match:
        return int(match.group(1)), int(match.group(2)), int(match.group(3))
    return None, None, None

def create_structured_dataset():
    """
    Reads the three source text files and merges them into a single,
    structured JSON file, perfect for use in an application.
    """
    print(">>> Starting the final merge process to create the JSON dataset.")

    try:
        with open(DEVANAGARI_FILE, "r", encoding="utf-8") as f:
            deva_lines = [line.strip() for line in f.readlines() if line.strip()]
        with open(TRANSLITERATION_FILE, "r", encoding="utf-8") as f:
            translit_lines = [line.strip() for line in f.readlines() if line.strip()]
        with open(TRANSLATION_FILE, "r", encoding="utf-8") as f:
            transla_lines = [line.strip() for line in f.readlines() if line.strip()]
    except FileNotFoundError as e:
        print(f"[ERROR] A required source file is missing: {e.filename}")
        print("        Please ensure all previous steps have been completed successfully.")
        return

    # --- Process translations into a more usable format ---
    # This creates a flat list of all translated verses in the exact order they appear.
    ordered_translations = [
        line.split('.', 1)[1].strip()
        for line in transla_lines
        if re.match(r"^\d+\.", line)
    ]

    rigveda_dataset = []
    current_verse_data = {}
    verse_counter = -1 # To index into the ordered_translations list

    # The transliteration file is our master guide for structure
    for i, line in enumerate(translit_lines):
        verse_id_str, translit_text = line.split(" ", 1)
        mandala, sukta, verse = parse_verse_id(verse_id_str)

        if not all((mandala, sukta, verse)):
            continue

        # Check if this is a new verse (e.g., moving from 1.1.1 to 1.1.2)
        new_verse_id = (mandala, sukta, verse)
        if new_verse_id != current_verse_data.get("id"):
            # If there's a completed verse, add it to our dataset
            if current_verse_data:
                rigveda_dataset.append(current_verse_data)
            
            verse_counter += 1
            # Start a new verse object
            current_verse_data = {
                "id": new_verse_id,
                "mandala": mandala,
                "sukta": sukta,
                "verse": verse,
                "devanagari": "",
                "transliteration": "",
                "translation_griffith": ordered_translations[verse_counter] if verse_counter < len(ordered_translations) else "Translation not found"
            }

        # Append the text parts to the current verse. This joins parts like 'a' and 'c'.
        # We assume the Devanagari file is perfectly aligned line-by-line with the transliteration file.
        if i < len(deva_lines):
            current_verse_data["devanagari"] += deva_lines[i] + " "
        
        current_verse_data["transliteration"] += translit_text + " "

    # Add the very last verse to the dataset
    if current_verse_data:
        rigveda_dataset.append(current_verse_data)

    # Final cleanup pass
    for verse in rigveda_dataset:
        verse["devanagari"] = verse["devanagari"].strip()
        verse["transliteration"] = verse["transliteration"].strip()
        del verse["id"] # Remove the temporary tuple ID

    # Write the final JSON file
    with open(OUTPUT_JSON_FILE, "w", encoding="utf-8") as f_json:
        json.dump(rigveda_dataset, f_json, ensure_ascii=False, indent=2)

    print("\n\n" + "="*50)
    print(">>>      HACKATHON DATASET COMPLETE!      <<<")
    print("="*50)
    print(f"\n    The final merged data has been saved to '{OUTPUT_JSON_FILE}'.")
    print("    You are now ready to build your application!")
    print("\n" + "="*50)


if __name__ == "__main__":
    create_structured_dataset()