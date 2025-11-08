import pandas as pd
import matplotlib.pyplot as plt

# Load relevant columns only
use_cols = ["timestamp", "af7_alpha", "af8_alpha", "af7_beta", "af8_beta"]

focus = pd.read_excel("muse_metrics_vlad_focus.xlsx", usecols=use_cols)
relax = pd.read_excel("muse_metrics_vlad_relax.xlsx", usecols=use_cols)

# Convert timestamp column to datetime
focus["timestamp"] = pd.to_datetime(focus["timestamp"])
relax["timestamp"] = pd.to_datetime(relax["timestamp"])

# Calculate alpha/beta ratio:
# (af7_alpha + af8_alpha) / (af7_beta + af8_beta)
focus["alpha_beta_ratio_calc"] = (focus["af7_alpha"] + focus["af8_alpha"]) / (focus["af7_beta"] + focus["af8_beta"])
relax["alpha_beta_ratio_calc"] = (relax["af7_alpha"] + relax["af8_alpha"]) / (relax["af7_beta"] + relax["af8_beta"])

# Plot calculated ratios over time
plt.plot(focus["timestamp"], focus["alpha_beta_ratio_calc"], label="Focus (calculated)")
plt.plot(relax["timestamp"], relax["alpha_beta_ratio_calc"], label="Relax (calculated)")

plt.xlabel("Time")
plt.ylabel("Alpha/Beta Ratio")
plt.title("Alpha/Beta Ratio Over Time (Calculated from raw channels)")
plt.legend()
plt.grid(True)
plt.tight_layout()

plt.show()
