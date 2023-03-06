const Express = require("express");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
const serviceAccount = require("./serviceAccount.json");
const fs = require("fs");
const app = Express();
const cors = require("cors");

const fb = initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

const getStates = (req, res) => {
  const statesJson = fs.readFileSync("./AppBrain/states.json");
  const states = JSON.parse(statesJson);
  res.set("Access-Control-Allow-Origin", "*");
  res.send(states);
};

const getPricing = (req, res) => {
  const pricingJson = fs.readFileSync("./AppBrain/pricing.json");
  const pricing = JSON.parse(pricingJson);
  res.set("Access-Control-Allow-Origin", "*");
  res.send(pricing);
};

class State {
  constructor() {
    this.data = {};
    this.setData = (item) => {
      this.data = { ...this.data, [item.id]: item };
    };
  }
}
const ReviewsData = new State();
const unsubReviews = () =>
  db
    .collection("reviews")
    .where("reaction", "==", "approved")
    .onSnapshot((snapshots) => {
      snapshots.forEach(async (snapshot) => {
        ReviewsData.setData(snapshot.data());
      });
    });
unsubReviews();
const RoutesData = new State();
const unsubRoutes = () =>
  db.collection("routes").onSnapshot((snapshots) => {
    snapshots.forEach(async (snapshot) => {
      RoutesData.setData(snapshot.data());
    });
  });
unsubRoutes();
const VehiclesData = new State();
const unsubVehicles = () =>
  db.collection("vehicles").onSnapshot((snapshots) => {
    snapshots.forEach(async (snapshot) => {
      const data = snapshot.data();
      VehiclesData.setData(data);
    });
  });
unsubVehicles();
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
app.post("/pricing", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  const { pricing_ } = req.body;
  const pricingJson = JSON.stringify(pricing_);
  fs.writeFileSync("./AppBrain/pricing.json", pricingJson);
  res.send(true);
});
app.get("/pricing", getPricing);
app.post("/ecommerce-user", (req, res) => {
  const { customer } = req.body;
  getAuth(fb)
    .createUser({
      uid: customer.id,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      password: "customer123",
      emailVerified: true,
      disabled: false,
      displayName: `${customer.firstName} ${customer.lastName}`,
    })
    .then(() => {
      res.send(true);
    })
    .catch((err) => {
      err && res.send(err);
    });
});
app.post("/api", (req, res) => {
  const { staff } = req.body;
  getAuth(fb)
    .createUser({
      uid: staff.id,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      password: staff.password,
      emailVerified: true,
      disabled: false,
      displayName: `${staff.firstName} ${staff.lastName}`,
    })
    .then(async (userRecord) => {
      const userRef = db.doc(`/users/${userRecord.uid}`);
      const snapshot = await userRef.get();
      if (!snapshot.exists) {
        const { displayName } = userRecord;
        const createdAt = admin.firestore.FieldValue.serverTimestamp();
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
    })
    .catch((error) => {
      res.send(error.message);
    });
});

app.get("/routes", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.send(RoutesData.data);
});
app.get("/stations", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.send(StationsData.data);
});
app.get("/reviews", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.send(ReviewsData.data);
});
app.get("/users", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.query.uid) {
    const uid = req.query.uid;
    res.send(UsersData.data[uid]);
  }
  if (req.query.role) {
    const role = req.query.role;
    const findUser = Object.keys(UsersData.data)
      .map((key) => UsersData.data[key])
      .filter((User) => User.role === role);
    const userObject = {};
    findUser.map((user) => {
      Object.assign(userObject, { [user.displayName]: user });
    });
    res.send(userObject);
  }
});
app.get("/vehicles", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.query.type === "interState") {
    const vehiclesSearch = Object.keys(VehiclesData.data)
      .map((key) => VehiclesData.data[key])
      .filter((vehicle) => vehicle.station === "");
    const foundVehicles = {};
    vehiclesSearch.map((vehicle) =>
      Object.assign(foundVehicles, { [vehicle.id]: vehicle })
    );
    res.send(foundVehicles);
  }
  if (req.query.station) {
    const vehiclesSearch = Object.keys(VehiclesData.data)
      .map((key) => VehiclesData.data[key])
      .filter((vehicle) => vehicle.station === req.query.station);
    const foundVehicles = {};
    vehiclesSearch.map((vehicle) =>
      Object.assign(foundVehicles, { [vehicle.id]: vehicle })
    );
    res.send(foundVehicles);
  }
  // res.send(VehiclesData.data);
});

app.listen(process.env.PORT || 5000, () =>
  console.log("Server running on port 5000")
);
