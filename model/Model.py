import pandas as pd

df = pd.read_csv('products.csv')
sample = df.sample(500, random_state=42)
sample.to_csv('sample.csv', index=False)