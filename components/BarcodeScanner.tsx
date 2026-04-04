import { CameraView } from "expo-camera";
import React, { useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    View
} from "react-native";

interface ScannerProps {
  onScan: (data: any) => void;
  onClose: () => void;
  loading: boolean;
  torch: boolean;
  setTorch: (val: boolean) => void;
  tabColor?: string;
  children?: React.ReactNode;
  cameraKey?: number;
  onCameraError?: () => void;
}

export const BarcodeScanner = ({
  onScan,
  onClose,
  loading,
  torch,
  setTorch,
  tabColor = "#00FF00",
  children,
  cameraKey = 0,
  onCameraError,
}: ScannerProps) => {
  console.log('🎥 [BarcodeScanner] Component rendering with cameraKey:', cameraKey);
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🎥 [BarcodeScanner] Mounted with cameraKey:', cameraKey);
    try {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      
      return () => {
        console.log('🛑 [BarcodeScanner] Unmounting - stopping animation');
        animation.stop();
      };
    } catch (err) {
      console.error('❌ [BarcodeScanner] Animation error:', err);
    }
  }, [cameraKey]);

  return (
    <View style={styles.container}>
      <CameraView
        key={cameraKey}
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={loading ? undefined : onScan}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "upc_a", "code128", "qr"] }}
        onMountError={(error) => {
          console.error('❌ [BarcodeScanner] Camera mount error:', error);
          if (onCameraError) {
            onCameraError();
          }
        }}
      />

      {/* Dark Overlay with Viewfinder hole */}
      <View style={styles.mainOverlay} pointerEvents="box-none">
        {/* Top Section (Where Tabs go) */}
        <View style={styles.topSection}>
          {children && React.Children.toArray(children)[0]}
        </View>

        {/* Middle Section (Viewfinder) */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
            <Animated.View
              style={[
                styles.scanLine,
                {
                  backgroundColor: tabColor,
                  shadowColor: tabColor,
                  transform: [
                    {
                      translateY: scanAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 250],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {loading && (
              <View style={styles.loadingInner}>
                <ActivityIndicator size="large" color={tabColor} />
              </View>
            )}
          </View>
        </View>

        {/* Bottom Section (Where Buttons/Hints go) */}
        <View style={styles.bottomSection}>
          {children && React.Children.toArray(children)[1]}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  mainOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "space-between", // Forces top and bottom sections to the edges
    zIndex: 1,
  },
  topSection: {
    paddingTop: 60,
    alignItems: "center",
    width: "100%",
  },
  viewfinderContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  viewfinder: {
    width: 280,
    height: 250,
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
  },
  bottomSection: {
    paddingBottom: 60,
    alignItems: "center",
    width: "100%",
  },
  scanLine: {
    height: 3,
    width: "100%",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#FFF",
    borderWidth: 5,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },
});
