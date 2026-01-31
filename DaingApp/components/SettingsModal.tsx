import React from "react";
import { View, Text, Modal, TouchableOpacity, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { modalStyles } from "../styles/modal";

interface SettingsModalProps {
  visible: boolean;
  devMode: boolean;
  serverBaseUrl: string;
  onToggleDevMode: () => void;
  onSetServerUrl: (url: string) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  devMode,
  serverBaseUrl,
  onToggleDevMode,
  onSetServerUrl,
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

          <TouchableOpacity
            style={modalStyles.settingRow}
            onPress={onToggleDevMode}
          >
            <Text style={modalStyles.settingText}>Developer Mode</Text>
            <View
              style={[
                modalStyles.checkbox,
                devMode && modalStyles.checkboxActive,
              ]}
            >
              {devMode && <Ionicons name="checkmark" size={18} color="white" />}
            </View>
          </TouchableOpacity>

          <Text style={modalStyles.settingDescription}>
            Enables data gathering mode for building training datasets
          </Text>

          <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}>
            <Text style={modalStyles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
