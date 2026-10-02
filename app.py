"""Streamlit entry point for the Smart Hospital Resource Allocation System."""
import streamlit as st

st.set_page_config(
    page_title="Smart Hospital Resource Allocation System",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<div style="background-color: #E3F2FD; border-left: 5px solid #1976D2; padding: 12px; border-radius: 4px; margin-bottom: 20px;">
    <strong>🏥 SMART HOSPITAL RESOURCE ALLOCATION SYSTEM (DAA Hackathon v3.0)</strong><br>
    <span style="font-size: 0.9em; color: #555;">
        DEMO DATA — FICTIONAL · Academic simulation, not clinical advice. Full interactive web experience is actively served on port 3000.
    </span>
</div>
""", unsafe_allow_html=True)

st.title("Smart Hospital Resource Allocation System")
st.write("Please interact with the full web app directly in your browser preview, or use `python cli.py run --dataset golden --trace` in the terminal.")
