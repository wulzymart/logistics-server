import Express from "express";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";
import bodyParser from "body-parser";
import fs from "fs";
import { formatWithOptions } from "util";
const fb = initializeApp({
  credential: admin.credential.cert("./serviceAccount.json"),
});

const db = admin.firestore();
const statesJson = fs.readFileSync("./AppBrain/states.json");
const states = JSON.parse(statesJson);
const getStates = (req, res) => {
  res.send(states);
};

const app = Express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
class State {
  constructor() {
    this.data = {};
    this.setData = (data) => {
      this.data = { ...this.data, [data.id]: data };
    };
  }
}

const RoutesData = new State();
const unsubRoutes = () =>
  db.collection("routes").onSnapshot((snapshots) => {
    snapshots.forEach(async (snapshot) => {
      RoutesData.setData(snapshot.data());
    });
  });
unsubRoutes();
const UsersData = new State();
const unsubUsers = () =>
  db.collection("users").onSnapshot((snapshots) => {
    snapshots.forEach(async (snapshot) => {
      UsersData.setData(snapshot.data());
    });
  });
unsubUsers();
const StationsData = new State();
const unsubStations = () =>
  db.collection("stations").onSnapshot((snapshots) => {
    snapshots.forEach(async (snapshot) => {
      StationsData.setData(snapshot.data());
    });
  });
unsubStations();
app.get("/states", getStates);
app.post("/states", (req, res) => {
  const states = req.body;
  const statesJson = JSON.stringify(states);
  fs.writeFileSync("./AppBrain/states.json", statesJson);
});
app.post("/api", (req, res) => {
  const staff = req.body;
  console.log(req.body);
  getAuth(fb)
    .createUser({
      uid: staff.id,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      password: staff.password,
      emailVerified: true,
      disabled: false,
      displayName: staff.firstName + " " + staff.lastName,
    })
    .then(async (userRecord) => {
      const userRef = db.doc(`/users/${userRecord.uid}`);
      const snapshot = await userRef.get();
      if (!snapshot.exists) {
        const { displayName, email } = userRecord;
        const createdAt = new Date().toUTCString();
        const { password, ...addtionalData } = staff;
        try {
          userRef
            .set({
              displayName,
              createdAt,
              ...addtionalData,
            })
            .then(() => res.send(true));
        } catch (error) {
          res.send("error creating user", error.message);
        }
      }
      // See the UserRecord reference doc for the contents of userRecord.
      console.log("Successfully created new user:", userRecord);
    })
    .catch((error) => {
      res.send(error.message);
    });
});
app.get("/test", (res, req) => {});
app.get("/routes", (req, res) => res.send(RoutesData.data));
app.get("/stations", (req, res) => res.send(StationsData.data));
app.get("/users", (req, res) => {
  if (req.query.uid) {
    const uid = req.query.uid;
    res.send(UsersData.data[uid]);
  }

  if (req.query.role) {
    const role = req.query.role;
    const findUser = Object.keys(UsersData.data)
      .map((key) => UsersData.data[key])
      .filter((User) => User.role === role);
    res.send(findUser);
  }
});
app.listen(5000, () => console.log("Server running on port 5000"));
