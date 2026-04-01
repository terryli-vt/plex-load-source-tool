import React, { useState } from "react";
import ScanInput from "../components/ScanInput";
import LogBox from "../components/LogBox";
import * as api from "../services/apiClient";
import WorkcenterInfo from "./../components/WorkcenterInfo";

const Edgefold: React.FC = () => {
  const workcenterKey = api.getEdgefoldWorkcenterKey();

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
  const [lastSerial, setLastSerial] = useState<string | null>(null);
  // handle the scanned result
  const handleScan = async (serialNo: string) => {
    setScanStatus("Loading"); // disable scan by setting loading state for scan input
    setBackgroundColor("#ffffff"); // reset background color
    setMessages(() => []); // clear messages
    setLastSerial(serialNo); // save the last scanned serial number

    try {
      let response = await api.checkWorkcenterLogin(workcenterKey);
      response = await api.checkContainer(serialNo);

      // Check if the container is on hold
      if (response.containerInfo["Status"] === "Hold") {
        throw new Error("Container is on hold.");
        // logMessage(`Changing container status from Hold to OK... ⏳`);
        // await api.changeContainerStatus(serialNo, "OK");
      }

      // Check if the container is inactive
      if (response.containerInfo["Quantity"] === 0) {
        throw new Error("Container is inactive.");
      }
      // logMessage(response.message);

      // Check if the scanned part number matches the workcenter setup
      const workcenterPartNo = workcenterInfo!["Part Number"];
      if (String(response.containerInfo["Part Number"]) != workcenterPartNo) {
        throw new Error(
          `Scanned part number does not match, please check workcenter configuration on Plex. Expected: ${workcenterPartNo}, Scanned: ${response.containerInfo["Part Number"]}`,
        );
      }
      // logMessage("Substrate part number matched ✔️");

      // Check if the container is ready for edgefolding
      if (String(response.containerInfo["Operation"]) != "Waterjet") {
        if (String(response.containerInfo["Operation"]) == "Edgefold-BFB") {
          throw new Error(`Serial No ${serialNo} was already edgefolded.`);
        }
        throw new Error(`Serial No ${serialNo} is not ready for edgefolding.`);
      }

      logMessage("Loading, please wait... ⏳");
      response = await api.recordProductionBFB(workcenterKey, serialNo);
      // logMessage(response.message, "#00CC66");
      logMessage("Success!", "#00CC66");

      setLastSerial(serialNo); // save the last scanned serial number
      await handleInfoUpdate(); // Refresh workcenter info
    } catch (error: any) {
      // Check for the specific edgefold error
      if (error.message === `Container Part Not Valid. Choose New Job.`) {
        logMessage(
          `Error: No job being selected. Please select a job on Plex ❌`,
          "#FF6666",
        );
      } else if (
        error.message === `Serial No ${serialNo} was already edgefolded.`
      ) {
        logMessage(`Warning: ${error.message} ⚠️`, "#FFA500"); // Orange background for the warning
      } else {
        logMessage(`Error: ${error.message} ❌`, "#FF6666"); // Red background for other errors
      }
      setLastSerial(null); // clear the last scanned serial number
    } finally {
      setScanStatus("Ready"); // enable scan
    }
  };

  const handleHold = async () => {
    if (!lastSerial) return;

    try {
      await api.changeContainerStatus(lastSerial, "Hold");
      logMessage("Hold Success!", "#00CC66");
    } catch (error: any) {
      logMessage(`Error: ${error.message} ❌`, "#FF6666");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Edgefold Station</h1>
      <div className="flex flex-col lg:flex-row">
        <div className="w-full lg:w-1/3 lg:pr-4 mb-4 lg:mb-0">
          <WorkcenterInfo
            workcenterName="Edgefold"
            status={infoStatus}
            plexServer={plexServer}
            workcenterInfo={workcenterInfo}
            onUpdate={handleInfoUpdate}
          />
        </div>
        <div
          className={`w-full lg:w-2/3 ${
            infoStatus === "Loaded" ? "" : "hidden"
          }`}
        >
          <div className="mb-4">
            <ScanInput
              onScan={handleScan}
              placeholder="Scan barcode on substrate label..."
              status={scanStatus}
            />
          </div>
          {lastSerial && (
            <div className="flex flex-col my-5 md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <button
                className={`btn btn-lg btn-warning flex-grow w-full md:w-auto`}
                onClick={() => handleHold()}
                disabled={scanStatus !== "Ready"}
              >
                Hold Container {lastSerial}
              </button>
            </div>
          )}
          <LogBox messages={messages} backgroundColor={backgroundColor} />
        </div>
      </div>
    </div>
  );
};

export default Edgefold;
