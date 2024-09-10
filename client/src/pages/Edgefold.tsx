import React, { useState } from "react";
import ScanInput from "../components/ScanInput";
import LogBox from "../components/LogBox";
import * as api from "../services/apiClient";
import WorkcenterInfo from "./../components/WorkcenterInfo";

const Edgefold: React.FC = () => {
  const workcenterKey = "74883"; // Edgefold1 workcenter key

  // For workcenterInfo component
  const [infoStatus, setInfoStatus] = useState<string>("Idle");
  const [workcenterInfo, setWorkcenterInfo] = useState<{
    [key: string]: string | number;
  } | null>(null);
  const [plexServer, setPlexServer] = useState<string | null>(null);

  // For handling update event from WorkcenterInfo component
  const handleInfoUpdate = async () => {
    setInfoStatus("Loading"); // workcenter info is loading
    setScanStatus("Idle"); // scan input is idle
    try {
      const info = await api.getWorkcenterInfo(workcenterKey); // fetched info
      setWorkcenterInfo(info);
      setPlexServer(api.getPlexServer());
      setInfoStatus("Loaded"); // workcenter info is loaded
      setScanStatus("Ready"); // scan input is ready
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setInfoStatus("Error");
    }
  };

  // LogBox Component
  // managing the message & background color
  const [messages, setMessages] = useState<string[]>([]); // State to manage log messages
  const [backgroundColor, setBackgroundColor] = useState<string>("#ffffff");

  // log messages and change background color
  const logMessage = (message: string, color?: string) => {
    setMessages((prevMessages) => [...prevMessages, message]);
    if (color) {
      setBackgroundColor(color);
    }
  };

  // ScanInput Component
  // Loading state for ScanInput (Idle, Loading, Ready)
  const [scanStatus, setScanStatus] = useState<string>("Idle");

  // handle the scanned result
  const handleScan = async (serialNo: string) => {
    setScanStatus("Loading"); // disable scan by setting loading state for scan input
    setBackgroundColor("#ffffff"); // reset background color
    setMessages(() => []); // clear messages

    try {
      let response = await api.checkContainer(serialNo);

      if (response.containerInfo["Quantity"] === 0) {
        throw new Error("Container is inactive.");
      }
      logMessage(response.message);

      // Check if the scanned part number matches the workcenter setup
      const workcenterPartNo = workcenterInfo!["Part Number"];
      if (String(response.containerInfo["Part Number"]) != workcenterPartNo) {
        throw new Error(
          `Scanned part number does not match, please check workcenter configuration on Plex. Expected: ${workcenterPartNo}, Scanned: ${response.containerInfo["Part Number"]}`
        );
      }
      logMessage("Substrate part number matched ✔️");

      // Check if the container is ready for edgefolding
      if (String(response.containerInfo["Operation"]) != "Waterjet") {
        if (String(response.containerInfo["Operation"]) == "Edgefold") {
          throw new Error(`Serial No ${serialNo} was already edgefolded.`);
        }
        throw new Error(`Serial No ${serialNo} is not ready for edgefolding.`);
      }

      logMessage("Recording production, please wait... ⏳");
      response = await api.recordProductionBFB(workcenterKey, serialNo);
      logMessage(response.message, "#00CC66");

      await handleInfoUpdate(); // Refresh workcenter info
    } catch (error: any) {
      logMessage(`Error: ${error.message} ❌`, "#FF6666");
    } finally {
      setScanStatus("Ready"); // enable scan
    }
  };

  const scanClassName = `w-2/3 ${infoStatus === "Loaded" ? "" : "hidden"}`;
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">RIVIAN Edgefold Station</h1>
      <div className="flex">
        <div className="w-1/3 pr-4">
          <WorkcenterInfo
            workcenterName="Edgefold"
            status={infoStatus}
            plexServer={plexServer}
            workcenterInfo={workcenterInfo}
            onUpdate={handleInfoUpdate}
          />
        </div>
        <div className={scanClassName}>
          <div className="mb-4">
            <ScanInput
              onScan={handleScan}
              placeholder="Scan barcode on substrate label..."
              status={scanStatus}
            />
          </div>
          <LogBox messages={messages} backgroundColor={backgroundColor} />
        </div>
      </div>
    </div>
  );
};

export default Edgefold;
