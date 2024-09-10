import React, { useEffect, useState } from "react";
import ScanInput from "../components/ScanInput";
import LogBox from "../components/LogBox";
import * as api from "../services/apiClient";
import WorkcenterInfo from "./../components/WorkcenterInfo";
import PackList from "./../components/PackList";

const Pack: React.FC = () => {
  const workcenterKey = "74895"; // Pack-Rivian workcenter key

  // For workcenterInfo component
  const [infoStatus, setInfoStatus] = useState<string>("Idle");
  const [workcenterInfo, setWorkcenterInfo] = useState<{
    [key: string]: string | number;
  } | null>(null);
  const [stdPackQty, setstdPackQty] = useState<number | null>(null);
  const [plexServer, setPlexServer] = useState<string | null>(null);

  // For handling update event from WorkcenterInfo component
  const handleInfoUpdate = async () => {
    setInfoStatus("Loading");
    setScanStatus("Idle"); // scan input is idle
    try {
      const info = await api.getWorkcenterInfo(workcenterKey); // fetched info
      setWorkcenterInfo(info);

      if (info && info["Part Number"]) {
        setstdPackQty(await api.getStdPackQty(info["Part Number"]));
      }
      setPlexServer(api.getPlexServer());
      setInfoStatus("Loaded");
      setScanStatus("Ready"); // scan input is ready
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setInfoStatus("Error");
    }
  };

  // PackList Component
  const [list, setList] = useState<string[]>([]);
  const [isPacking, setIsPacking] = useState(false);

  // Handle unloading a serial number
  const handleUnload = async (serialNo: string) => {
    if (list.length === 0) {
      setBackgroundColor("#ffffff"); // reset background color
      setMessages(() => []); // clear messages
    }

    try {
      // Change serial's location back to assembly station
      await api.moveContainer(serialNo, "RIVIAN");
      logMessage(`Container ${serialNo} is unloaded ✔️`, "#00CC66");
    } catch (error: any) {
      logMessage(`Error: ${error.message} ❌`, "#FF6666");
    }
    setList(list.filter((s) => s !== serialNo));
  };

  // Handle packing action (called when progress is 100% or user confirms)
  const handlePack = async () => {
    setIsPacking(true);
    try {
      // Record production
      logMessage("Recording production, please wait... ⏳");
      let response = await api.recordProduction(workcenterKey, list.length);
      const newSerialNo = response.newSerialNo;
      logMessage(response.message);

      // Print label
      response = await api.printLabel(newSerialNo, "Pack-Rivian");
      logMessage(response.message, "#00CC66");

      await handleInfoUpdate(); // Refresh workcenter info
      setList([]); // Reset the list after packing
    } catch (error: any) {
      logMessage(`Error: ${error.message} ❌`, "#FF6666");
    } finally {
      setIsPacking(false); // packing finished
    }
  };

  // Add to pack list
  const addToList = (serialNo: string) => {
    // prevent duplicates
    if (list.includes(serialNo)) {
      logMessage("This serial number is already in the pack list.", "#FF6666");
      return;
    }

    if (list.length < stdPackQty!) {
      setList([...list, serialNo]);
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
    setScanStatus("Loading"); // disable scan
    if (list.length === 0) {
      setBackgroundColor("#ffffff"); // reset background color
      setMessages(() => []); // clear messages
    }

    try {
      let response = await api.checkContainer(serialNo);

      // Check if the container is active
      if (response.containerInfo["Quantity"] === 0) {
        throw new Error("Container is inactive.");
      }

      // Check if the scanned part number matches the workcenter setup
      const workcenterPartNo = workcenterInfo!["Part Number"];
      if (String(response.containerInfo["Part Number"]) != workcenterPartNo) {
        throw new Error(
          `Scanned part number does not match, please check workcenter configuration on Plex. Expected: ${workcenterPartNo}, Scanned: ${response.containerInfo["Part Number"]}`
        );
      }

      // Check if the container is in Assembly operation
      if (String(response.containerInfo["Operation"]) !== "Assembly") {
        throw new Error(
          `This container is not in Assembly operation. Current operation: ${response.containerInfo["Operation"]}`
        );
      }

      response = await api.moveContainer(serialNo, "Pack-Rivian");
      // logMessage(response.message); // container moved
      logMessage(`${serialNo} is packed ✔️`, "#00CC66");
      addToList(serialNo); // Add to pack list
    } catch (error: any) {
      logMessage(`Error: ${error.message} ❌`, "#FF6666");
    } finally {
      setScanStatus("Ready"); // enable scan
    }
  };

  // prevent accidental page refresh
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    // Attach the event listener
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">RIVIAN Pack Station</h1>
      <div className="flex">
        <div className="w-1/3 pr-4">
          <WorkcenterInfo
            workcenterName="Pack"
            status={infoStatus}
            plexServer={plexServer}
            workcenterInfo={workcenterInfo}
            onUpdate={handleInfoUpdate}
            stdPackQty={stdPackQty}
          />
        </div>
        <div
          className={`w-1/3 pr-4 ${infoStatus === "Loaded" ? "" : "hidden"}`}
        >
          <PackList
            stdPackQty={stdPackQty!}
            list={list}
            onPack={handlePack}
            onUnload={handleUnload}
            isPacking={isPacking}
          />
        </div>
        <div className={`w-1/3 ${infoStatus === "Loaded" ? "" : "hidden"}`}>
          <div className="mb-4">
            <ScanInput
              onScan={handleScan}
              placeholder="Scan barcode on FG label..."
              status={scanStatus}
            />
          </div>
          <LogBox messages={messages} backgroundColor={backgroundColor} />
        </div>
      </div>
    </div>
  );
};

export default Pack;
