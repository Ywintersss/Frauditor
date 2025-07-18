import pandas as pd
import numpy as np
import pickle
import re
import warnings
import time

# NLP libraries
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.sentiment import SentimentIntensityAnalyzer
from textblob import TextBlob

# ML libraries
from scipy.sparse import hstack

warnings.filterwarnings("ignore")


resources = {
    "punkt": "tokenizers/punkt",
    "stopwords": "corpora/stopwords",
    "wordnet": "corpora/wordnet",
    "vader_lexicon": "sentiment/vader_lexicon",
}

for name, path in resources.items():
    try:
        nltk.data.find(path)
    except LookupError:
        nltk.download(name, quiet=True)


class FrauditorInference:
    """
    Inference class for the trained Frauditor model
    """

    def __init__(self, model_path="frauditor_model.pkl"):
        """
        Initialize the inference system

        Args:
            model_path (str): Path to the trained model file
        """
        self.model_path = model_path
        self.model_data = None
        self.detector = None
        self.preprocessor = None
        self.sia = SentimentIntensityAnalyzer()
        self.stop_words = set(stopwords.words("english"))

        # Load the model
        self.load_model()

        # Initialize preprocessor
        self.preprocessor = FrauditorPreprocessor()

    def load_model(self):
        """Load the trained model and all components"""
        try:
            with open(self.model_path, "rb") as f:
                self.model_data = pickle.load(f)

            # Extract components
            self.models = self.model_data["models"]
            self.vectorizers = self.model_data["vectorizers"]
            self.scaler = self.model_data["scaler"]
            self.feature_names = self.model_data["feature_names"]
            self.detector = self.model_data["detector"]

            print(f"✅ Model loaded successfully from {self.model_path}")
            print(
                f"📊 Model version: {self.model_data.get('metadata', {}).get('version', 'Unknown')}"
            )

        except Exception as e:
            print(f"❌ Error loading model: {e}")
            raise

    def predict_single_review(self, text):
        """
        Predict if a single review is fake or real

        Args:
            text (str): Review text to analyze

        Returns:
            dict: Prediction results with detailed analysis
        """
        if not self.model_data:
            raise ValueError("Model not loaded. Please check the model path.")

        # Preprocess text
        cleaned_text = self.preprocessor.clean_text(text)
        features = self.preprocessor.extract_linguistic_features(cleaned_text)

        # Prepare features for prediction
        X = self._prepare_single_features(cleaned_text, features)

        # Make prediction using ensemble model
        start_time = time.time()
        ensemble_model = self.models["ensemble"]

        probability = ensemble_model.predict_proba(X)[0]
        prediction = ensemble_model.predict(X)[0]
        prediction_time = time.time() - start_time

        # Determine risk level
        fake_prob = probability[1]
        if fake_prob >= 0.8:
            risk_level = "HIGH"
        elif fake_prob >= 0.6:
            risk_level = "MEDIUM"
        elif fake_prob >= 0.4:
            risk_level = "LOW"
        else:
            risk_level = "MINIMAL"

        # Compile results
        result = {
            "prediction": "FAKE" if prediction == 1 else "REAL",
            "confidence": float(max(probability)),
            "fake_probability": float(probability[1]),
            "real_probability": float(probability[0]),
            "risk_level": risk_level,
            "prediction_time": prediction_time,
            "text_length": len(text),
            "cleaned_text_length": len(cleaned_text),
            "analysis_details": {
                "word_count": features.get("word_count", 0),
                "sentiment_score": features.get("sentiment_compound", 0),
                "malaysian_terms_detected": features.get("malaysian_terms_count", 0),
                "has_mixed_language": features.get("has_mixed_language", False),
                "has_specific_details": features.get("has_specific_details", False),
                "text_quality_score": self._calculate_quality_score(features),
                "linguistic_features": {
                    "exclamation_count": features.get("exclamation_count", 0),
                    "caps_ratio": features.get("caps_ratio", 0),
                    "punctuation_ratio": features.get("punctuation_ratio", 0),
                    "avg_word_length": features.get("avg_word_length", 0),
                    "product_terms_count": features.get("product_terms_count", 0),
                    "has_generic_phrases": features.get("has_generic_phrases", False),
                    "has_promotional_language": features.get(
                        "has_promotional_language", False
                    ),
                },
            },
        }

        return result

    def predict_batch(self, texts):
        """
        Predict multiple reviews at once

        Args:
            texts (list): List of review texts to analyze

        Returns:
            list: List of prediction results
        """
        results = []

        for i, text in enumerate(texts):
            print(f"Processing review {i + 1}/{len(texts)}")
            result = self.predict_single_review(text)
            results.append(result)

        return results

    def _prepare_single_features(self, cleaned_text, features):
        """Prepare features for single prediction"""

        # Text features using TF-IDF
        tfidf_features = self.vectorizers["tfidf"].transform([cleaned_text])

        # Linguistic features
        linguistic_features = [
            "length",
            "word_count",
            "avg_word_length",
            "sentence_count",
            "exclamation_count",
            "question_count",
            "caps_ratio",
            "punctuation_ratio",
            "sentiment_compound",
            "sentiment_positive",
            "sentiment_negative",
            "malaysian_terms_count",
            "malaysian_terms_ratio",
            "product_terms_count",
            "product_terms_ratio",
            "repeated_words",
            "spelling_errors",
            "textblob_polarity",
            "textblob_subjectivity",
        ]

        binary_features = [
            "has_mixed_language",
            "has_specific_details",
            "has_generic_phrases",
            "has_promotional_language",
        ]

        all_features = linguistic_features + binary_features

        # Prepare feature vector
        feature_vector = []
        for feature in all_features:
            value = features.get(feature, 0)
            if feature in binary_features:
                value = int(value)
            feature_vector.append(value)

        # Scale features
        ling_features = self.scaler.transform([feature_vector])

        # Combine TF-IDF and linguistic features
        combined = hstack([tfidf_features, ling_features])

        return combined

    def _calculate_quality_score(self, features):
        """Calculate text quality score"""
        score = 50

        # Positive indicators
        if features.get("word_count", 0) >= 15:
            score += 10
        if features.get("malaysian_terms_count", 0) > 0:
            score += 15
        if features.get("has_mixed_language", False):
            score += 10
        if features.get("has_specific_details", False):
            score += 10

        # Negative indicators
        if features.get("exclamation_count", 0) > 5:
            score -= 15
        if features.get("has_generic_phrases", False):
            score -= 10
        if features.get("has_promotional_language", False):
            score -= 15

        return max(0, min(100, score))

    def analyze_review_features(self, text):
        """
        Detailed analysis of review features for debugging

        Args:
            text (str): Review text

        Returns:
            dict: Detailed feature analysis
        """
        cleaned_text = self.preprocessor.clean_text(text)
        features = self.preprocessor.extract_linguistic_features(cleaned_text)

        return {
            "original_text": text,
            "cleaned_text": cleaned_text,
            "features": features,
            "quality_score": self._calculate_quality_score(features),
        }


class FrauditorPreprocessor:
    """
    Text preprocessing for inference
    """

    def __init__(self):
        self.stop_words = set(stopwords.words("english"))
        self.sia = SentimentIntensityAnalyzer()

        # Malaysian-specific terms
        self.malaysian_local_terms = {
            "shiok",
            "confirm",
            "steady",
            "power",
            "cantik",
            "lawa",
            "terror",
            "bagus",
            "teruk",
            "rosak",
            "murah",
            "baik",
            "elok",
            "mantap",
            "tiptop",
            "padu",
            "mmg",
            "sgt",
            "dia",
            "kt",
            "kat",
            "dah",
            "tak",
            "beli",
            "dapat",
            "sampai",
            "cepat",
            "lambat",
            "ok",
            "okay",
            "best",
            "nice",
            "cheap",
            "mahal",
        }

        # Product-specific terms
        self.product_terms = {
            "delivery",
            "packaging",
            "quality",
            "size",
            "color",
            "material",
            "fitting",
            "comfort",
            "battery",
            "charge",
            "sound",
            "screen",
            "camera",
            "performance",
            "seller",
            "service",
            "price",
            "value",
        }

    def clean_text(self, text):
        """Clean text for processing"""
        if pd.isna(text) or text == "":
            return ""

        text = str(text).lower()

        # Remove URLs, emails, and phone numbers
        text = re.sub(
            r"http\S+|www\S+|https\S+|\S+@\S+|\+?6\d{1,3}-?\d{3,4}-?\d{3,4}", "", text
        )

        # Normalize excessive punctuation
        text = re.sub(r"[!]{2,}", "!", text)
        text = re.sub(r"[?]{2,}", "?", text)
        text = re.sub(r"[.]{2,}", ".", text)

        # Normalize repeated characters
        text = re.sub(r"([a-zA-Z])\1{2,}", r"\1\1", text)

        # Remove special characters but keep basic punctuation
        text = re.sub(r"[^a-zA-Z0-9\s.,!?-]", "", text)

        # Remove extra whitespaces
        text = re.sub(r"\s+", " ", text).strip()

        return text

    def extract_linguistic_features(self, text):
        """Extract linguistic features from text"""
        if pd.isna(text) or text == "":
            return self._get_empty_features()

        text = str(text).lower()

        # Tokenize words
        try:
            words = word_tokenize(text) if text else []
        except:
            words = text.split() if text else []

        # Basic text statistics
        features = {
            "length": len(text),
            "word_count": len(words),
            "avg_word_length": np.mean([len(word) for word in words]) if words else 0,
            "sentence_count": len(re.split(r"[.!?]+", text)) if text else 0,
            "exclamation_count": text.count("!"),
            "question_count": text.count("?"),
            "caps_ratio": sum(1 for c in text if c.isupper()) / len(text)
            if text
            else 0,
            "punctuation_ratio": sum(1 for c in text if c in ".,!?;:") / len(text)
            if text
            else 0,
        }

        # Sentiment analysis
        sentiment = self.sia.polarity_scores(text)
        features.update(
            {
                "sentiment_compound": sentiment["compound"],
                "sentiment_positive": sentiment["pos"],
                "sentiment_negative": sentiment["neg"],
                "sentiment_neutral": sentiment["neu"],
            }
        )

        # Malaysian-specific features
        malaysian_count = sum(1 for word in words if word in self.malaysian_local_terms)
        product_count = sum(1 for word in words if word in self.product_terms)

        features.update(
            {
                "malaysian_terms_count": malaysian_count,
                "malaysian_terms_ratio": malaysian_count / len(words) if words else 0,
                "product_terms_count": product_count,
                "product_terms_ratio": product_count / len(words) if words else 0,
                "has_mixed_language": self._detect_mixed_language(text),
                "has_specific_details": product_count >= 2,
            }
        )

        # Suspicious patterns
        features.update(
            {
                "has_generic_phrases": any(
                    phrase in text
                    for phrase in [
                        "highly recommend",
                        "best product ever",
                        "amazing quality",
                        "exceeded expectations",
                        "perfect product",
                        "love it so much",
                        "exactly what i needed",
                        "great value for money",
                    ]
                ),
                "has_promotional_language": any(
                    phrase in text
                    for phrase in [
                        "buy now",
                        "great deal",
                        "discount",
                        "sale",
                        "limited time",
                        "special offer",
                        "best price",
                    ]
                ),
                "repeated_words": len(words) - len(set(words)) if words else 0,
                "spelling_errors": sum(
                    1
                    for word in words
                    if len(word) > 3
                    and not word.isalpha()
                    and word not in self.stop_words
                )
                if words
                else 0,
            }
        )

        # TextBlob sentiment
        blob = TextBlob(text)
        features["textblob_polarity"] = blob.sentiment.polarity
        features["textblob_subjectivity"] = blob.sentiment.subjectivity

        return features

    def _detect_mixed_language(self, text):
        """Detect mixed English-Malay language"""
        malay_indicators = ["yang", "dan", "ini", "itu", "dengan", "untuk", "dari"]
        english_indicators = ["the", "and", "this", "that", "with", "for", "from"]

        has_malay = any(word in text.lower() for word in malay_indicators)
        has_english = any(word in text.lower() for word in english_indicators)

        return has_malay and has_english

    def _get_empty_features(self):
        """Return empty features for invalid text"""
        return {
            "length": 0,
            "word_count": 0,
            "avg_word_length": 0,
            "sentence_count": 0,
            "exclamation_count": 0,
            "question_count": 0,
            "caps_ratio": 0,
            "punctuation_ratio": 0,
            "sentiment_compound": 0,
            "sentiment_positive": 0,
            "sentiment_negative": 0,
            "sentiment_neutral": 0,
            "malaysian_terms_count": 0,
            "malaysian_terms_ratio": 0,
            "product_terms_count": 0,
            "product_terms_ratio": 0,
            "has_mixed_language": False,
            "has_specific_details": False,
            "has_generic_phrases": False,
            "has_promotional_language": False,
            "repeated_words": 0,
            "spelling_errors": 0,
            "textblob_polarity": 0,
            "textblob_subjectivity": 0,
        }


def getPredictions(file_path, data):
    # Initialize the inference system

    final = {}
    frauditor = FrauditorInference(file_path)

    for key, review in data.items():
        result = frauditor.predict_single_review(review["review_content"])

        final[key] = result

    return final
