import json
import pandas as pd
import os
import re
from typing import List, Dict, Any


def extract_review_number(review_key: str) -> int:
    """Extract numeric part from review key (e.g., 'review 1' -> 1)"""
    match = re.search(r"review (\d+)", review_key)
    return int(match.group(1)) if match else 0


def flatten_review_data(review_data: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten a single review's data including subreview"""
    flattened = {
        "username": review_data.get("username", ""),
        "ratings": review_data.get("ratings", ""),
        "purchase_date": review_data.get("purchase_date", ""),
        "item_variation": review_data.get("item_variation", ""),
        "location": review_data.get("location", ""),
        "review_content": review_data.get("review_content", ""),
        "has_image": review_data.get("has_image", False),
    }

    # Flatten subreview data
    subreview = review_data.get("subreview", {})
    if subreview:
        for sub_key, sub_data in subreview.items():
            if isinstance(sub_data, dict):
                category = sub_data.get("category", "")
                content = sub_data.get("content", "")
                flattened[f"subreview_{sub_key}_category"] = category
                flattened[f"subreview_{sub_key}_content"] = content

    return flattened


def process_json_files_pandas(file_paths: List[str]):
    """Process multiple JSON files and return a merged DataFrame"""
    all_data = []
    current_review_number = 1

    for file_path in file_paths:
        print(f"Processing {file_path}...")
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                data = json.load(file)

            # Get all review keys and sort them by their original number
            review_items = [(k, v) for k, v in data.items() if k.startswith("review")]
            review_items.sort(key=lambda x: extract_review_number(x[0]))

            # Process each review in the file
            for review_key, review_data in review_items:
                flattened_data = flatten_review_data(review_data)
                flattened_data["review_number"] = current_review_number
                flattened_data["original_file"] = file_path
                flattened_data["original_review_key"] = review_key
                all_data.append(flattened_data)
                current_review_number += 1

        except FileNotFoundError:
            print(f"Warning: File {file_path} not found")
        except json.JSONDecodeError:
            print(f"Warning: Invalid JSON in file {file_path}")

    if not all_data:
        print("No data found in any files")
        return pd.DataFrame()

    # Create DataFrame
    df = pd.DataFrame(all_data)

    # Organize columns in logical order
    basic_columns = [
        "review_number",
        "username",
        "ratings",
        "purchase_date",
        "item_variation",
        "location",
        "review_content",
        "has_image",
    ]
    subreview_columns = sorted(
        [col for col in df.columns if col.startswith("subreview_")]
    )
    metadata_columns = ["original_file", "original_review_key"]
    column_order = basic_columns + subreview_columns + metadata_columns
    existing_columns = [col for col in column_order if col in df.columns]

    return df[existing_columns]


def auto_discover_and_process():
    """Auto-discover JSON files and process them to CSV"""
    # Find all JSON files in current directory
    json_files = [f for f in os.listdir(".") if f.endswith(".json")]

    if not json_files:
        print("No JSON files found in current directory")
        return

    print(f"Found JSON files: {json_files}")

    output_csv = "merged_reviews.csv"
    df = process_json_files_pandas(json_files)

    if df.empty:
        print("No data to process")
        return

    df.to_csv(output_csv, index=False, encoding="utf-8")

    print(f"Successfully created {output_csv}")
    print(f"Total reviews: {len(df)}")
    print(
        f"Review numbers range: {df['review_number'].min()} to {df['review_number'].max()}"
    )


if __name__ == "__main__":
    # Option 1: Auto-discover and process all JSON files
    auto_discover_and_process()

    # Option 2: Process specific files (uncomment and modify as needed)
    # json_files = ['file1.json', 'file2.json']
    # df = process_json_files_pandas(json_files)
    # df.to_csv('merged_reviews.csv', index=False, encoding='utf-8')
    # print(f"Successfully created merged_reviews.csv with {len(df)} reviews")
