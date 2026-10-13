import { getDataConnect, type DataConnect } from "firebase/data-connect";
import { connectorConfig } from "@/src/generated/dataconnect";
import { getFirebaseApp } from "./firebase";

let dataConnect: DataConnect | undefined;

export function getShieldDataConnect(): DataConnect {
  if (!dataConnect) {
    dataConnect = getDataConnect(getFirebaseApp(), connectorConfig);
  }

  return dataConnect;
}