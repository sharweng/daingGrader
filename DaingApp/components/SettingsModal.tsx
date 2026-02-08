import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { modalStyles } from "../styles/modal";

interface SettingsModalProps {
  visible: boolean;
  autoSaveDataset: boolean;
  serverBaseUrl: string;
  confidenceThreshold: number;
  onToggleAutoSaveDataset: () => void;
  onSetServerUrl: (url: string) => void;
  onSetConfidenceThreshold: (value: number) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  autoSaveDataset,
  serverBaseUrl,
  confidenceThreshold,
  onToggleAutoSaveDataset,
  onSetServerUrl,
  onSetConfidenceThreshold,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.modalOverlay}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={modalStyles.modalContent}>
          <View style={modalStyles.modalHandle} />
          <Text style={modalStyles.modalTitle}>Settings</Text>

          <View style={modalStyles.inputSection}>
            <Text style={modalStyles.inputLabel}>Server URL</Text>
            <TextInput
              style={modalStyles.input}
              value={serverBaseUrl}
              onChangeText={onSetServerUrl}
              placeholder="http://192.168.1.108:8000"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          <Text style={modalStyles.settingDescription}>
            Enter your backend server address (e.g., http://192.168.1.5:8000)
          </Text>

          {/* Confidence Threshold Slider */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={modalStyles.inputLabel}>Detection Confidence</Text>
              <Text style={styles.sliderValue}>
                {Math.round(confidenceThreshold * 100)}%
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.3}
              maximumValue={0.95}
              step={0.05}
              value={confidenceThreshold}
              onValueChange={onSetConfidenceThreshold}
              minimumTrackTintColor="#3B82F6"
              maximumTrackTintColor="#334155"
              thumbTintColor="#3B82F6"
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>30%</Text>
              <Text style={styles.sliderLabelText}>95%</Text>
            </View>
          </View>

          <Text style={modalStyles.settingDescription}>
            Minimum confidence level required to detect fish. Lower values
            detect more but may include false positives.
          </Text>

          <TouchableOpacity
            style={modalStyles.settingRow}
            onPress={onToggleAutoSaveDataset}
          >
            <Text style={modalStyles.settingText}>Auto-Save to Dataset</Text>
            <View
              style={[
                modalStyles.checkbox,
                autoSaveDataset && modalStyles.checkboxActive,
              ]}
            >
              {autoSaveDataset && (
                <Ionicons name="checkmark" size={18} color="white" />
              )}
            </View>
          </TouchableOpacity>

          <Text style={modalStyles.settingDescription}>
            Automatically save high-confidence scans (85%+) to training dataset
          </Text>

          <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}>
            <Text style={modalStyles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sliderSection: {
    marginBottom: 8,
    marginTop: 8,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3B82F6",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sliderLabelText: {
    fontSize: 12,
    color: "#64748B",
  },
});
