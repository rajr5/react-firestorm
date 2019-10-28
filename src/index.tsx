interface DocumentSnapshot {
  exists: any;
  data: any;
}
interface QuerySnapshot {
  forEach: any;
  data: any;
}

export interface ListenerConfig {
  collection: string;
  id?: string;
  query?: (string | boolean)[];
  attach?: (data: any) => {[propName: string]: any};
  limit?: number;
}

export type ListenerCallback = (data: any) => void;
const PROFILE_COLLECTION = "profiles";
const DEFAULT_LIMIT = 20;

interface SaveOptions {
  setOwner?: boolean;
}

export interface FireStormProfile {
  id: string;
  admin?: boolean;
}

// Allow this to work from Node as Admin or directly in React/React-Native
function isFirebaseAdmin(firebase: any) {
  return Boolean(firebase.credential);
}

function getListenerKey(config: ListenerConfig): string {
  if (!config.id && !config.query) {
    return config.collection;
  } else if (config.id) {
    return `${config.collection}/${config.id}`;
  } else {
    return `${config.collection}?${config.query}`;
  }
}

function extractDocs(snap: QuerySnapshot) {
  const data: {[id: string]: any} = {};
  snap.forEach((d: any) => {
    if (d.id) {
      data[d.id] = d.data();
    }
  });
  return data;
}

class FirestormService {
  firebase: any;
  firestore: any;
  listeners: {[id: string]: any} = {};
  listenerCallbacks: {[id: string]: ListenerCallback[]} = {};
  data: {[collection: string]: {[id: string]: any}} = {};
  profile?: FireStormProfile;
  authStateListener: any;
  userChangeCallbacks: ((profile?: FireStormProfile) => void)[] = [];

  public signup = async (
    credential: {email: string; password: string},
    additionalUserData: any = {}
  ) => {
    let uid;
    if (credential && credential.email) {
      const userCredential = await this.firebase
        .auth()
        .createUserWithEmailAndPassword(credential.email, credential.password);
      uid = userCredential.user.uid;
    } else {
      console.error("[firestore] Unsupported login method.", credential);
      throw new Error("Unsupported login method.");
    }
    this.addListener({collection: PROFILE_COLLECTION, id: uid}, () => {});

    return this.saveDocument(PROFILE_COLLECTION, {
      id: uid,
      email: credential.email,
      ...additionalUserData,
    });
  };

  public login = async (credential: {email: string; password: string}) => {
    let uid: string;
    if (credential && credential.email) {
      const userCredential = await this.firebase
        .auth()
        .signInWithEmailAndPassword(credential.email, credential.password);
      uid = userCredential.user.uid;
    } else {
      console.error("[firestore] Unsupported login method.", credential);
      throw new Error("Unsupported login method.");
    }
    this.addListener({collection: PROFILE_COLLECTION, id: uid}, () => {});
    const snapshot = await this.firestore
      .collection(PROFILE_COLLECTION)
      .doc(uid)
      .get();
    return snapshot.data();
  };

  public logout = async () => {
    return this.firebase.auth().signOut();
  };

  public updateProfile = async (update: any) => {
    const user = this.getUser();
    if (!user) {
      throw new Error("No user cached, cannot update user.");
    }
    console.log(`[firestore] Updating user id: ${user.id}`, update);
    await this.firestore
      .collection(PROFILE_COLLECTION)
      .doc(user.id)
      .update({...update, updated: new Date()});
  };

  public getUser = () => {
    return this.profile;
  };

  private buildQuery = (config: ListenerConfig) => {
    if (config.query) {
      return this.firestore
        .collection(config.collection)
        .where(config.query[0], config.query[1] as any, config.query[2])
        .limit(config.limit || DEFAULT_LIMIT)
        .orderBy("updated", "desc");
    } else {
      return this.firestore
        .collection(config.collection)
        .limit(config.limit || DEFAULT_LIMIT)
        .orderBy("updated", "desc");
    }
  };

  public addListener = async (c: ListenerConfig, callback: (data: any) => void) => {
    let config = typeof c === "string" ? {collection: c} : c;
    console.log("[firestore] Adding listener", config);

    // If the document id isn't set yet, don't listen to the whole collection (which may be a
    // firestore permissions error).
    if (typeof c !== "string" && Object.keys(c).indexOf("id") !== -1 && !c["id"]) {
      return;
    }

    try {
      if (!config.id) {
        if (this.listeners[getListenerKey(config)]) {
          console.debug(
            "[firestore] Already listening to collection, not adding another subscription",
            config
          );
          return;
        }
        const onSnapshot = (snap: any) => {
          const data = extractDocs(snap);
          callback(data);
        };
        let unsubscribe = this.buildQuery(config).onSnapshot(onSnapshot);

        onSnapshot(
          await this.firestore
            .collection(config.collection)
            .limit(config.limit || DEFAULT_LIMIT)
            .orderBy("updated", "desc")
            .get()
        );
        return unsubscribe;
      } else if (config.id) {
        const onSnapshot = (snap: DocumentSnapshot) => {
          // console.log("[firestore] doc snapshot", config.collection, config.id, snap);
          if (snap.exists) {
            callback(snap.data());
          } else {
            callback(undefined);
          }
        };
        console.log("[firestore] Adding listener", config);
        let unsubscribe = this.firestore
          .collection(config.collection)
          .doc(config.id)
          .onSnapshot(onSnapshot);
        onSnapshot(
          await this.firestore
            .collection(config.collection)
            .doc(config.id)
            .get()
        );
        return unsubscribe;
      } else if (config.query) {
        console.warn("[firestore] Not supported yet");
      }
    } catch (e) {
      console.error(
        `[firestore] Error listening for updates on collection ${config.collection}, id: ${config.id}`,
        e
      );
      throw e;
    }
    return;
  };

  public getDocuments = async (config: ListenerConfig) => {
    let docs;
    try {
      docs = await this.firestore.collection(config.collection).get();
    } catch (e) {
      console.error(`[firestore] Error getting collection: ${config.collection}/`, e);
      throw e;
    }
    return extractDocs(docs);
  };

  public getDocument = async (collection: string, id: string) => {
    let doc;
    try {
      doc = await this.firestore
        .collection(collection)
        .doc(id)
        .get();
    } catch (e) {
      console.error(`[firestore] Error getting doc: ${collection}/${id}`, e);
      throw e;
    }
    if (doc.exists) {
      return doc.data();
    } else {
      return undefined;
    }
  };

  public updateDocument = async (collection: string, partial: any) => {
    console.log("Update not implemented yet", collection, partial);
    throw new Error("Update not implemented");
  };

  public saveDocument = async (collection: string, document: any, options: SaveOptions = {}) => {
    if (!document) {
      console.warn(`Tried to save undefined document to collection: ${collection}`);
      return;
    }
    if (!document.id) {
      console.warn(`Tried to save document without id to collection: ${collection}`, document);
      return;
    }
    const doc = await this.firestore
      .collection(collection)
      .doc(document.id)
      .get();

    let extraData = {};
    const user = this.getUser();
    if (options.setOwner && user) {
      extraData = {...extraData, ownerId: user.id};
    }
    document = {...document, ...extraData};

    if (doc.exists) {
      console.log(`[firestore] Updating ${collection} id: ${document.id}`, document);
      try {
        await this.firestore
          .collection(collection)
          .doc(document.id)
          .update({...document, updated: new Date()});
      } catch (e) {
        console.error(
          `[firestore] Error updating doc: ${collection}/${document.id}, update:`,
          document,
          "Error: ",
          e
        );
        throw e;
      }
    } else {
      console.log(`[firestore] Creating ${collection} id: ${document.id}`, document);
      await this.firestore
        .collection(collection)
        .doc(document.id)
        .set({...document, created: new Date(), updated: new Date()});
    }
    return document;
  };

  // TODO: set as .deleted = true, filter everywhere else.
  public deleteDocument = async (collection: string, documentId: string) => {
    try {
      await this.firestore
        .collection(collection)
        .doc(documentId)
        .delete();
    } catch (e) {
      console.error(`[firestore] Error deleting document: ${collection}/${documentId}`);
    }
  };

  public init(firebase: any) {
    // console.log("FB", firebase);
    this.firebase = firebase;
    this.firestore = firebase.firestore();
    console.log("[firestore] initializing FirestoreORM");
    if (isFirebaseAdmin(this.firebase)) {
      return;
    }
    firebase.auth().onAuthStateChanged(async (user: any) => {
      console.log("[firestore] auth state changed", user);
      if (user && !this.authStateListener) {
        this.authStateListener = this.addListener(
          {collection: PROFILE_COLLECTION, id: user.uid},
          (data: any) => {
            this.profile = data;
          }
        );
        const profileDoc = (await this.getDocument(
          PROFILE_COLLECTION,
          user.uid
        )) as FireStormProfile;
        if (profileDoc) {
          this.profile = profileDoc;
          console.log("[firestore] Found user profile", profileDoc);
          for (let cb of this.userChangeCallbacks) {
            cb && cb(this.profile);
          }
        } else {
          console.warn("[firestore] Could not find matching profile for user", user.uid);
        }
      } else if (!user) {
        for (let cb of this.userChangeCallbacks) {
          cb && cb(undefined);
        }
      }
    });
  }

  public onProfileStateChanged(callback: (profile: any) => void) {
    if (this.profile && this.profile.id) {
      callback(this.profile);
      return;
    }
    this.userChangeCallbacks.push(callback);
  }
}

export const FireStorm = new FirestormService();