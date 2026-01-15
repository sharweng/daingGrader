import { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Button,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import axios from "axios";

// =========================================================
// 🛑 IMPORTANT: REPLACE THIS WITH YOUR COMPUTER'S IP
// Example: 'http://192.168.1.5:8000/analyze'
// =========================================================
const SERVER_URL = "http://192.168.1.112:8000/analyze";

export default function Index() {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: "center", marginBottom: 20, color: "white" }}>
          We need your camera permission
        </Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  // 1. TAKE PICTURE
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo) {
          // Resize to save bandwidth
          const manipulated = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 800 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          setCapturedImage(manipulated.uri);
        }
      } catch (error) {
        console.error("Camera Error:", error);
      }
    }
  };

  // 2. SEND TO PYTHON SERVER
  const analyzeFish = async () => {
    if (!capturedImage) return;
    setLoading(true);

    const formData = new FormData();
    // @ts-ignore: React Native FormData requires these specific fields
    formData.append("file", {
      uri: capturedImage,
      name: "fish.jpg",
      type: "image/jpeg",
    });

    try {
      const response = await axios.post(SERVER_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob", // Expect image back
      });

      // Convert Blob to Viewable Image
      const fileReaderInstance = new FileReader();
      fileReaderInstance.readAsDataURL(response.data);
      fileReaderInstance.onload = () => {
        if (typeof fileReaderInstance.result === "string") {
          setResultImage(fileReaderInstance.result);
        }
        setLoading(false);
      };
    } catch (error) {
      console.error("Server Error:", error);
      alert(
        `Connection Failed!\nMake sure your IP is correct.\nCurrent Target: ${SERVER_URL}`
      );
      setLoading(false);
    }
  };

  // 3. RESET
  const reset = () => {
    setCapturedImage(null);
    setResultImage(null);
  };

  return (
    <View style={styles.container}>
      {/* SCENARIO A: SHOW RESULT FROM SERVER */}
      {resultImage ? (
        <View style={styles.previewContainer}>
          <Text style={styles.header}>✅ ANALYSIS COMPLETE</Text>
          <Image source={{ uri: resultImage }} style={styles.previewImage} />
          <TouchableOpacity style={styles.button} onPress={reset}>
            <Text style={styles.text}>Scan Another</Text>
          </TouchableOpacity>
        </View>
      ) : /* SCENARIO B: SHOW PREVIEW BEFORE SENDING */
      capturedImage ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          {loading ? (
            <ActivityIndicator size="large" color="#00ff00" />
          ) : (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "red" }]}
                onPress={reset}
              >
                <Text style={styles.text}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "green" }]}
                onPress={analyzeFish}
              >
                <Text style={styles.text}>Analyze</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        /* SCENARIO C: LIVE CAMERA */
        <CameraView style={styles.camera} ref={cameraRef}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
            >
              <View style={styles.innerButton} />
            </TouchableOpacity>
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black", justifyContent: "center" },
  camera: { flex: 1 },
  buttonContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "transparent",
    margin: 64,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  innerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "black",
  },
  previewContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  previewImage: {
    width: "90%",
    height: "70%",
    resizeMode: "contain",
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: "blue",
    marginHorizontal: 10,
  },
  text: { fontSize: 18, fontWeight: "bold", color: "white" },
  row: { flexDirection: "row" },
  header: {
    fontSize: 20,
    color: "#00ff00",
    marginBottom: 20,
    fontWeight: "bold",
  },
});
