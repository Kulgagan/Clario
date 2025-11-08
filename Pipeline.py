from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds, BrainFlowError
import numpy as np
import time
import mne
from mne.preprocessing import ICA

# ------------------------------
# STEP 1: Collect EEG data with BrainFlow
# ------------------------------
params = BrainFlowInputParams()
params.mac_address = 'YOUR_DEVICE_MAC'  # replace with your Muse 2 MAC
board = BoardShim(BoardIds.MUSE_2_BOARD.value, params)

try:
    board.prepare_session()
    board.start_stream()
    print("⏳ Streaming EEG data for 5 seconds...")
    time.sleep(5)  # stream for 5 seconds

    # get data from BrainFlow
    data = board.get_board_data()  # numpy array (channels x samples)
    print("✅ EEG data collected!")

    # ------------------------------
    # STEP 2: Process EEG data with MNE
    # ------------------------------
    print("🧠 Starting preprocessing with MNE...")

    # Muse 2 channel indices: TP9, AF7, AF8, TP10
    # BrainFlow returns all channels, we select only EEG channels
    eeg_channels = [1, 2, 3, 4]  # BrainFlow channel indices for EEG
    eeg_data = data[eeg_channels, :]  # shape: (n_channels, n_samples)

    # Sampling rate
    sfreq = board.get_sampling_rate(BoardIds.MUSE_2_BOARD.value)

    # Channel names and types
    ch_names = ['TP9', 'AF7', 'AF8', 'TP10']
    ch_types = ['eeg'] * len(ch_names)

    # Create MNE Raw object
    info = mne.create_info(ch_names=ch_names, sfreq=sfreq, ch_types=ch_types)
    raw = mne.io.RawArray(eeg_data, info)

    # Set electrode positions
    montage = mne.channels.make_standard_montage('standard_1020')
    raw.set_montage(montage)

    # Filters
    raw.notch_filter(freqs=[60])
    raw.filter(l_freq=1.0, h_freq=40.0)

    # ICA artifact removal
    ica = ICA(n_components=len(ch_names), random_state=97, max_iter='auto')
    ica.fit(raw)

    # Detect eye-blink artifacts (AF7 & AF8 are near eyes)
    eog_inds, eog_scores = ica.find_bads_eog(raw, ch_name=['AF7', 'AF8'])
    ica.exclude = eog_inds
    print(f"🔹 ICA excluded components: {ica.exclude}")

    raw_clean = ica.apply(raw.copy())

    # Re-reference
    raw_clean.set_eeg_reference('average', projection=True)

    # Save cleaned data
    raw_clean.save("cleaned_focus_eeg.fif", overwrite=True)
    print("✅ Preprocessing complete! Saved as cleaned_focus_eeg.fif")

except BrainFlowError as e:
    print(f"❌ BrainFlowError: {e}")

finally:
    print("🔹 Releasing session...")
    board.release_session()
