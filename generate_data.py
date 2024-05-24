import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# Function to generate date range
def generate_date_range(start_date, end_date, n_dates):
    return pd.date_range(start=start_date, end=end_date, periods=n_dates)

# Define the ranges for legends
legend_ranges = {
    'A': (0, 1),
    'B': (0, 50000),
    'C': (10000, 15000),
    'D': (200, 800),
    'E': (500, 1000)
}

# Initialize lists to store data
dates = []
values = []
legends = []

# Define initial Date1
date1 = datetime(2024, 1, 1)

# Generate data for each legend
for legend, (value_min, value_max) in legend_ranges.items():
    # Adjust Date1 with +/- 5 days
    adjusted_date1 = date1 + timedelta(days=random.randint(-5, 5))
    # Define Date2 as 100 days after adjusted Date1
    date2 = adjusted_date1 + timedelta(days=99)
    
    # Generate 100 dates
    date_range = generate_date_range(adjusted_date1, date2, 100)
    
    # Generate 100 values
    value_range = np.random.uniform(value_min, value_max, 100)
    
    # Append data to lists
    dates.extend(date_range)
    values.extend(value_range)
    legends.extend([legend] * 100)

# Create DataFrame
df = pd.DataFrame({
    'X': dates,
    'Y': values,
    'Legend': legends
})

import ace_tools as tools; tools.display_dataframe_to_user(name="Generated Series Data", dataframe=df)

df.head()
