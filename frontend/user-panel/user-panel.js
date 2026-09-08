// =========================================================
// LEARNIFY — USER PANEL JAVASCRIPT
// Firebase Authentication + Student Dashboard
// NextWave Commerce
//
// NEW IN THIS VERSION:
//   - Settings: change email + change password (with re-auth)
//   - Profile: purchased courses + feedback the student has given
//   - Certificates: auto-populated from Firestore once a course hits 100%
//   - Meetings: pulled from Firestore for paid courses + live notification
//   - Contact Support: wired to WhatsApp (+92 341 3231540)
//
// ASSUMED FIRESTORE SCHEMA (adjust names if yours differ):
//   users/{uid}                -> name, email, photoURL, provider, role
//   courses/{courseId}         -> title, description, price, image, ...
//   enrollments/{id}           -> userId, courseId, paymentStatus, status, progress
//   certificates/{id}          -> userId, courseId, courseTitle, issuedAt, certificateUrl
//   meetings/{id}              -> courseId, title, meetLink, scheduledAt
//   courseFeedback/{id}        -> userId, courseId, courseTitle, rating, comment, createdAt
// =========================================================

"use strict";

// =========================================================
// FIREBASE AUTH IMPORTS
// =========================================================

import {
    browserLocalPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    GoogleAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateEmail,
    updatePassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

// =========================================================
// FIREBASE CONFIG
// =========================================================

import { auth, db } from "./firebase-config.js";

// =========================================================
// FIRESTORE
// =========================================================

import {
    addDoc,
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// =========================================================
// DOM HELPERS
// =========================================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// =========================================================
// GLOBAL STATE
// =========================================================

let currentUser = null;
let allCourses = [];
let myCourses = [];
let myCertificates = [];
let myMeetings = [];
let myFeedback = [];
let currentSection = "dashboard";
let selectedFeedbackRating = 0;
let seenMeetingIds = new Set();
let meetingsUnsubscribe = null;
let notifications = []; // { id, message, createdAt }

// =========================================================
// ELEMENTS
// =========================================================

const pageLoader = $("#pageLoader");
const authView = $("#authView");
const dashboardView = $("#dashboardView");
const loginTab = $("#loginTab");
const registerTab = $("#registerTab");
const loginForm = $("#loginForm");
const registerForm = $("#registerForm");
const authTitle = $("#authTitle");
const authSubtitle = $("#authSubtitle");
const authSwitch = $("#authSwitch");
const authMessage = $("#authMessage");
const loginPassword = $("#loginPassword");
const registerPassword = $("#registerPassword");
const registerConfirmPassword = $("#registerConfirmPassword");
const showLoginPassword = $("#showLoginPassword");
const showRegisterPassword = $("#showRegisterPassword");
const showConfirmPassword = $("#showConfirmPassword");
const passwordStrength = $("#passwordStrength");
const strengthText = $("#strengthText");
const forgotPassword = $("#forgotPassword");
const forgotPasswordModal = $("#forgotPasswordModal");
const closeForgotModal = $("#closeForgotModal");
const forgotPasswordForm = $("#forgotPasswordForm");
const googleButton = $("#googleButton");
const logoutBtn = $("#logoutBtn");
const dropdownLogout = $("#dropdownLogout");
const dashboardUserName = $("#dashboardUserName");
const welcomeUserName = $("#welcomeUserName");
const dropdownUserName = $("#dropdownUserName");
const dropdownUserEmail = $("#dropdownUserEmail");
const userAvatar = $("#userAvatar");
const dashboardYear = $("#dashboardYear");
const notificationButton = $("#notificationButton");
const notificationPanel = $("#notificationPanel");
const closeNotifications = $("#closeNotifications");
const profileButton = $("#profileButton");
const profileDropdown = $("#profileDropdown");
const sidebarToggle = $("#sidebarToggle");
const dashboardSidebar = $("#dashboardSidebar");
const courseSearch = $("#courseSearch");

// Settings
const changeEmailForm = $("#changeEmailForm");
const changePasswordForm = $("#changePasswordForm");

// Feedback modal
const feedbackModal = $("#feedbackModal");
const feedbackForm = $("#feedbackForm");
const closeFeedbackModalBtn = $("#closeFeedbackModal");
const feedbackStarRating = $("#feedbackStarRating");

// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    initializeLoader();
    initializeAuthentication();
    initializePasswordControls();
    initializePasswordStrength();
    initializeForgotPassword();
    initializeGoogleLogin();
    initializeDashboard();
    initializeNotifications();
    initializeProfileDropdown();
    initializeSidebar();
    initializeSearch();
    initializeKeyboardControls();
    initializeTheme();
    initializeSettingsForms();
    initializeFeedbackModal();
    initializeFirebaseAuth();

});

// =========================================================
// PAGE LOADER
// =========================================================

function initializeLoader() {
    window.addEventListener("load", () => {
        setTimeout(() => {
            pageLoader?.classList.add("hidden");
        }, 350);
    });
}

// =========================================================
// FIREBASE AUTH STATE
// =========================================================

function initializeFirebaseAuth() {
    onAuthStateChanged(auth, async (user) => {

        if (user) {

            currentUser = user;

            const panelUser = {
                uid: user.uid,
                name: user.displayName || getNameFromEmail(user.email),
                email: user.email || "",
                photoURL: user.photoURL || ""
            };

            updateUserInformation(panelUser);
            showDashboard(panelUser);
            await loadStudentData();

        } else {

            currentUser = null;
            allCourses = [];
            myCourses = [];
            myCertificates = [];
            myMeetings = [];
            myFeedback = [];
            seenMeetingIds = new Set();

            if (meetingsUnsubscribe) {
                meetingsUnsubscribe();
                meetingsUnsubscribe = null;
            }

            showLoginView();
        }

    });
}

// =========================================================
// AUTHENTICATION UI
// =========================================================

function initializeAuthentication() {

    loginTab?.addEventListener("click", () => showAuthMode("login"));
    registerTab?.addEventListener("click", () => showAuthMode("register"));
    loginForm?.addEventListener("submit", handleLogin);
    registerForm?.addEventListener("submit", handleRegister);

    checkInitialAuthMode();
}

function showAuthMode(mode) {

    clearAuthMessage();
    clearFormErrors();

    if (mode === "register") {

        loginTab?.classList.remove("active");
        registerTab?.classList.add("active");
        loginForm?.classList.remove("active");
        registerForm?.classList.add("active");

        if (authTitle) authTitle.textContent = "Create your account";
        if (authSubtitle) authSubtitle.textContent = "Join Learnify and start learning today.";

        if (authSwitch) {
            authSwitch.innerHTML = `
                Already have an account?
                <button type="button" id="switchToLogin">Sign In</button>
            `;
            $("#switchToLogin")?.addEventListener("click", () => showAuthMode("login"));
        }

    } else {

        loginTab?.classList.add("active");
        registerTab?.classList.remove("active");
        loginForm?.classList.add("active");
        registerForm?.classList.remove("active");

        if (authTitle) authTitle.textContent = "Welcome back";
        if (authSubtitle) authSubtitle.textContent = "Sign in to continue your learning journey.";

        if (authSwitch) {
            authSwitch.innerHTML = `
                Don't have an account?
                <button type="button" id="switchToRegister">Create Account</button>
            `;
            $("#switchToRegister")?.addEventListener("click", () => showAuthMode("register"));
        }

    }
}

function checkInitialAuthMode() {
    const params = new URLSearchParams(window.location.search);
    showAuthMode(params.get("register") === "true" ? "register" : "login");
}

// =========================================================
// LOGIN
// =========================================================

async function handleLogin(event) {

    event.preventDefault();
    clearFormErrors();
    clearAuthMessage();

    const email = $("#loginEmail")?.value.trim();
    const password = loginPassword?.value || "";
    const remember = $("#rememberMe")?.checked || false;

    let valid = true;

    if (!email) {
        showFieldError("loginEmail", "Please enter your email address.");
        valid = false;
    } else if (!isValidEmail(email)) {
        showFieldError("loginEmail", "Please enter a valid email address.");
        valid = false;
    }

    if (!password) {
        showFieldError("loginPassword", "Please enter your password.");
        valid = false;
    }

    if (!valid) return;

    const loginButton = $("#loginButton");
    setButtonLoading(loginButton, true, "Signing in...");

    try {

        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
        const result = await signInWithEmailAndPassword(auth, email, password);
        await saveFirebaseUser(result.user, "password");
        showAuthMessage("Login successful. Welcome back!", "success");

    } catch (error) {
        console.error("Login error:", error);
        showAuthError(error);
    } finally {
        setButtonLoading(loginButton, false);
    }
}

// =========================================================
// REGISTER
// =========================================================

async function handleRegister(event) {

    event.preventDefault();
    clearFormErrors();
    clearAuthMessage();

    const name = $("#registerName")?.value.trim();
    const email = $("#registerEmail")?.value.trim();
    const password = registerPassword?.value || "";
    const confirmPassword = registerConfirmPassword?.value || "";
    const terms = $("#agreeTerms")?.checked || false;

    let valid = true;

    if (!name || name.length < 2) {
        showFieldError("registerName", "Please enter your full name.");
        valid = false;
    }

    if (!email) {
        showFieldError("registerEmail", "Please enter your email address.");
        valid = false;
    } else if (!isValidEmail(email)) {
        showFieldError("registerEmail", "Please enter a valid email address.");
        valid = false;
    }

    if (!password) {
        showFieldError("registerPassword", "Please create a password.");
        valid = false;
    } else if (password.length < 8) {
        showFieldError("registerPassword", "Password must contain at least 8 characters.");
        valid = false;
    }

    if (password !== confirmPassword) {
        showFieldError("registerConfirmPassword", "Passwords do not match.");
        valid = false;
    }

    if (!terms) {
        showAuthMessage("Please accept the Terms and Privacy Policy.", "error");
        valid = false;
    }

    if (!valid) return;

    const registerButton = $("#registerButton");
    setButtonLoading(registerButton, true, "Creating account...");

    try {

        await setPersistence(auth, browserLocalPersistence);
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        await updateProfile(user, { displayName: name });

        await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: email,
            photoURL: "",
            provider: "password",
            role: "student",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        showAuthMessage("Account created successfully. Welcome to Learnify!", "success");

    } catch (error) {
        console.error("Registration error:", error);
        showAuthError(error);
    } finally {
        setButtonLoading(registerButton, false);
    }
}

// =========================================================
// GOOGLE LOGIN
// =========================================================

function initializeGoogleLogin() {

    if (!googleButton) return;

    googleButton.addEventListener("click", async () => {

        clearAuthMessage();
        setButtonLoading(googleButton, true, "Connecting...");

        try {

            await setPersistence(auth, browserLocalPersistence);
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: "select_account" });

            const result = await signInWithPopup(auth, provider);
            await saveFirebaseUser(result.user, "google");

            showAuthMessage("Google sign-in successful! Welcome to Learnify.", "success");

        } catch (error) {
            console.error("Google sign-in error:", error);
            showAuthError(error);
        } finally {
            setButtonLoading(googleButton, false);
        }

    });
}

// =========================================================
// SAVE USER
// =========================================================

async function saveFirebaseUser(user, provider = "password") {

    await setDoc(doc(db, "users", user.uid), {
        name: user.displayName || getNameFromEmail(user.email),
        email: user.email || "",
        photoURL: user.photoURL || "",
        provider: provider,
        role: "student",
        updatedAt: serverTimestamp()
    }, { merge: true });
}

// =========================================================
// SETTINGS — CHANGE EMAIL / CHANGE PASSWORD
// Both are sensitive Firebase Auth operations and require the
// user to re-authenticate with their current password first.
// =========================================================

function initializeSettingsForms() {

    changeEmailForm?.addEventListener("submit", handleChangeEmail);
    changePasswordForm?.addEventListener("submit", handleChangePassword);

}

async function reauthenticateCurrentUser(currentPassword) {

    if (!currentUser || !currentUser.email) {
        throw new Error("No signed-in user with an email/password account.");
    }

    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
}

async function handleChangeEmail(event) {

    event.preventDefault();

    const currentPasswordInput = $("#currentPasswordForEmail");
    const newEmailInput = $("#newEmail");
    const messageBox = $("#emailChangeMessage");
    const button = $("#changeEmailButton");

    const currentPassword = currentPasswordInput?.value || "";
    const newEmail = newEmailInput?.value.trim() || "";

    setSettingsMessage(messageBox, "", "");

    if (!currentPassword) {
        setSettingsMessage(messageBox, "Please enter your current password.", "error");
        return;
    }

    if (!isValidEmail(newEmail)) {
        setSettingsMessage(messageBox, "Please enter a valid new email address.", "error");
        return;
    }

    setButtonLoading(button, true, "Updating...");

    try {

        await reauthenticateCurrentUser(currentPassword);
        await updateEmail(currentUser, newEmail);

        await setDoc(doc(db, "users", currentUser.uid), {
            email: newEmail,
            updatedAt: serverTimestamp()
        }, { merge: true });

        updateUserInformation({
            uid: currentUser.uid,
            name: currentUser.displayName || getNameFromEmail(newEmail),
            email: newEmail,
            photoURL: currentUser.photoURL || ""
        });

        setSettingsMessage(messageBox, "Your email address has been updated.", "success");
        changeEmailForm.reset();

    } catch (error) {
        console.error("Change email error:", error);
        setSettingsMessage(messageBox, getFriendlyAuthErrorMessage(error), "error");
    } finally {
        setButtonLoading(button, false);
    }
}

async function handleChangePassword(event) {

    event.preventDefault();

    const currentPasswordInput = $("#currentPasswordForPassword");
    const newPasswordInput = $("#newPassword");
    const confirmNewPasswordInput = $("#confirmNewPassword");
    const messageBox = $("#passwordChangeMessage");
    const button = $("#changePasswordButton");

    const currentPassword = currentPasswordInput?.value || "";
    const newPassword = newPasswordInput?.value || "";
    const confirmNewPassword = confirmNewPasswordInput?.value || "";

    setSettingsMessage(messageBox, "", "");

    if (!currentPassword) {
        setSettingsMessage(messageBox, "Please enter your current password.", "error");
        return;
    }

    if (newPassword.length < 8) {
        setSettingsMessage(messageBox, "New password must contain at least 8 characters.", "error");
        return;
    }

    if (newPassword !== confirmNewPassword) {
        setSettingsMessage(messageBox, "New passwords do not match.", "error");
        return;
    }

    setButtonLoading(button, true, "Updating...");

    try {

        await reauthenticateCurrentUser(currentPassword);
        await updatePassword(currentUser, newPassword);

        setSettingsMessage(messageBox, "Your password has been updated.", "success");
        changePasswordForm.reset();

    } catch (error) {
        console.error("Change password error:", error);
        setSettingsMessage(messageBox, getFriendlyAuthErrorMessage(error), "error");
    } finally {
        setButtonLoading(button, false);
    }
}

function setSettingsMessage(box, message, type) {

    if (!box) return;

    if (!message) {
        box.textContent = "";
        box.className = "settings-form-message";
        return;
    }

    box.textContent = message;
    box.className = `settings-form-message show ${type}`;
}

// =========================================================
// LOAD STUDENT DATA
// =========================================================

async function loadStudentData() {

    if (!currentUser) return;

    try {

        await loadAllCourses();
        await loadMyCourses();
        await loadCertificates();
        await loadMeetings();
        await loadMyFeedback();

        initializeMeetingNotifications();

        updateDashboardStats();
        renderAllCourses();
        renderMyCourses();
        renderProfileSection();

    } catch (error) {
        console.error("Student data loading error:", error);
    }
}

// =========================================================
// LOAD ALL COURSES
// =========================================================

async function loadAllCourses() {

    const coursesRef = collection(db, "courses");
    const snapshot = await getDocs(coursesRef);

    allCourses = [];

    snapshot.forEach((courseDoc) => {
        const data = courseDoc.data();
        if (data.active !== false) {
            allCourses.push({ id: courseDoc.id, ...data });
        }
    });

}

// =========================================================
// LOAD MY COURSES
// =========================================================

async function loadMyCourses() {

    if (!currentUser) return;

    const enrollmentQuery = query(
        collection(db, "enrollments"),
        where("userId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(enrollmentQuery);
    const enrolledIds = [];

    snapshot.forEach((enrollmentDoc) => {

        const data = enrollmentDoc.data();
        const paid = data.paymentStatus === "paid";
        const active = data.status !== "cancelled";

        if (paid && active && data.courseId) {
            enrolledIds.push(data.courseId);
        }

    });

    myCourses = allCourses
        .filter(course => enrolledIds.includes(course.id))
        .map(course => ({ ...course }));

}

// =========================================================
// CERTIFICATES
// A certificate document is created automatically the first
// time a course's progress reaches 100%. In production this
// issuing step should really run in a trusted backend/Cloud
// Function (triggered off the enrollment's progress field)
// rather than the client, so a student can't grant themselves
// a certificate — this client-side version is a placeholder
// for that flow.
// =========================================================

async function loadCertificates() {

    if (!currentUser) return;

    const certQuery = query(
        collection(db, "certificates"),
        where("userId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(certQuery);

    myCertificates = [];

    snapshot.forEach((certDoc) => {
        myCertificates.push({ id: certDoc.id, ...certDoc.data() });
    });

    await issueCertificatesForCompletedCourses();

    renderCertificates();

}

async function issueCertificatesForCompletedCourses() {

    const completedCourses = myCourses.filter(
        course => Number(course.progress || 0) >= 100
    );

    for (const course of completedCourses) {

        const alreadyIssued = myCertificates.some(
            cert => cert.courseId === course.id
        );

        if (alreadyIssued) continue;

        try {

            const newCertRef = await addDoc(collection(db, "certificates"), {
                userId: currentUser.uid,
                courseId: course.id,
                courseTitle: course.title || "Untitled Course",
                issuedAt: serverTimestamp()
            });

            myCertificates.push({
                id: newCertRef.id,
                userId: currentUser.uid,
                courseId: course.id,
                courseTitle: course.title || "Untitled Course",
                issuedAt: new Date()
            });

        } catch (error) {
            console.error("Certificate issue error:", error);
        }

    }

}

function renderCertificates() {

    const grid = $("#certificatesGrid");
    if (!grid) return;

    const certCountElement = $("#certificateCount");
    if (certCountElement) {
        certCountElement.textContent = myCertificates.length;
    }

    if (!myCertificates.length) {
        grid.innerHTML = createEmptyState(
            "No certificates yet",
            "Complete a course to earn your certificate."
        );
        return;
    }

    grid.innerHTML = myCertificates.map(cert => {

        const issuedDate = formatFirestoreDate(cert.issuedAt);

        return `
            <div class="certificate-card">
                <div class="certificate-icon"><i class="fa-solid fa-award"></i></div>
                <h3>${escapeHTML(cert.courseTitle || "Course Certificate")}</h3>
                <p>Issued ${issuedDate}</p>
                ${
                    cert.certificateUrl
                        ? `<a class="browse-courses-button" href="${escapeHTML(cert.certificateUrl)}" target="_blank" rel="noopener">
                                <i class="fa-solid fa-download"></i> Download
                           </a>`
                        : ""
                }
            </div>
        `;

    }).join("");

}

// =========================================================
// MEETINGS
// Pulled for any course the student has actually paid for.
// A live listener also watches for newly-added meetings on
// those same courses so the student gets a notification the
// moment a Google Meet is scheduled after they pay.
// =========================================================

async function loadMeetings() {

    if (!currentUser || !myCourses.length) {
        myMeetings = [];
        renderMeetings();
        updateMeetingCount();
        return;
    }

    const courseIds = myCourses.map(course => course.id).slice(0, 30);

    const meetingQuery = query(
        collection(db, "meetings"),
        where("courseId", "in", courseIds)
    );

    const snapshot = await getDocs(meetingQuery);

    myMeetings = [];

    snapshot.forEach((meetingDoc) => {
        myMeetings.push({ id: meetingDoc.id, ...meetingDoc.data() });
        seenMeetingIds.add(meetingDoc.id);
    });

    myMeetings.sort((a, b) => {
        const dateA = a.scheduledAt?.toMillis ? a.scheduledAt.toMillis() : 0;
        const dateB = b.scheduledAt?.toMillis ? b.scheduledAt.toMillis() : 0;
        return dateA - dateB;
    });

    renderMeetings();
    updateMeetingCount();

}

function initializeMeetingNotifications() {

    if (meetingsUnsubscribe) {
        meetingsUnsubscribe();
        meetingsUnsubscribe = null;
    }

    if (!currentUser || !myCourses.length) return;

    const courseIds = myCourses.map(course => course.id).slice(0, 30);

    const meetingQuery = query(
        collection(db, "meetings"),
        where("courseId", "in", courseIds)
    );

    meetingsUnsubscribe = onSnapshot(meetingQuery, (snapshot) => {

        let hasNewMeeting = false;

        snapshot.docChanges().forEach((change) => {

            if (change.type === "added" && !seenMeetingIds.has(change.doc.id)) {

                seenMeetingIds.add(change.doc.id);
                hasNewMeeting = true;

                const data = change.doc.data();
                const course = allCourses.find(item => item.id === data.courseId);

                addNotification(
                    `A new meeting${course ? ` for "${course.title}"` : ""} has been scheduled${
                        data.title ? `: ${data.title}` : ""
                    }.`
                );

            }

        });

        if (hasNewMeeting) {
            loadMeetings();
        }

    });

}

function renderMeetings() {

    const list = $("#meetingsList");
    if (!list) return;

    if (!myMeetings.length) {
        list.innerHTML = createEmptyState(
            "No upcoming meetings",
            "Your course meetings will appear here once you're enrolled in a course with a scheduled session."
        );
        return;
    }

    list.innerHTML = myMeetings.map(meeting => {

        const course = allCourses.find(item => item.id === meeting.courseId);
        const scheduled = formatFirestoreDate(meeting.scheduledAt, true);

        return `
            <div class="meeting-card">
                <div class="meeting-info">
                    <strong>${escapeHTML(meeting.title || "Live Session")}</strong>
                    <span>${escapeHTML(course?.title || "Course")} • ${scheduled}</span>
                </div>
                ${
                    meeting.meetLink
                        ? `<a class="meeting-join-button" href="${escapeHTML(meeting.meetLink)}" target="_blank" rel="noopener">
                                <i class="fa-solid fa-video"></i> Join Meet
                           </a>`
                        : `<span class="meeting-join-button" style="opacity:.5;cursor:not-allowed;">Link coming soon</span>`
                }
            </div>
        `;

    }).join("");

}

function updateMeetingCount() {

    const countElement = $("#meetingCount");
    if (countElement) {
        countElement.textContent = myMeetings.length;
    }

}

// =========================================================
// FEEDBACK — leave feedback on a paid course, and show it
// on the student's profile.
// =========================================================

function initializeFeedbackModal() {

    closeFeedbackModalBtn?.addEventListener("click", closeFeedbackModal);

    feedbackModal?.addEventListener("click", (event) => {
        if (event.target === feedbackModal) closeFeedbackModal();
    });

    feedbackStarRating?.querySelectorAll("i").forEach((star) => {
        star.addEventListener("click", () => {
            selectedFeedbackRating = Number(star.dataset.value);
            updateStarDisplay();
        });
    });

    feedbackForm?.addEventListener("submit", handleFeedbackSubmit);

}

function openFeedbackModal(course) {

    if (!feedbackModal) return;

    $("#feedbackCourseId").value = course.id;
    $("#feedbackModalTitle").textContent = `Leave Feedback — ${course.title || "Course"}`;
    $("#feedbackComment").value = "";
    selectedFeedbackRating = 0;
    updateStarDisplay();

    feedbackModal.hidden = false;

}

function closeFeedbackModal() {
    if (feedbackModal) feedbackModal.hidden = true;
}

function updateStarDisplay() {

    feedbackStarRating?.querySelectorAll("i").forEach((star) => {
        star.classList.toggle("active", Number(star.dataset.value) <= selectedFeedbackRating);
    });

}

async function handleFeedbackSubmit(event) {

    event.preventDefault();

    if (!currentUser) return;

    const courseId = $("#feedbackCourseId").value;
    const comment = $("#feedbackComment").value.trim();
    const course = allCourses.find(item => item.id === courseId);

    if (!selectedFeedbackRating) {
        showAuthMessage("Please select a star rating before submitting.", "error");
        return;
    }

    if (!comment) {
        showAuthMessage("Please write a short comment for your feedback.", "error");
        return;
    }

    const button = $("#submitFeedbackButton");
    setButtonLoading(button, true, "Submitting...");

    try {

        await addDoc(collection(db, "courseFeedback"), {
            userId: currentUser.uid,
            courseId: courseId,
            courseTitle: course?.title || "Course",
            rating: selectedFeedbackRating,
            comment: comment,
            createdAt: serverTimestamp()
        });

        closeFeedbackModal();
        showAuthMessage("Thanks! Your feedback has been submitted.", "success");

        await loadMyFeedback();
        renderProfileSection();

    } catch (error) {
        console.error("Feedback submit error:", error);
        showAuthMessage("Something went wrong submitting your feedback. Please try again.", "error");
    } finally {
        setButtonLoading(button, false);
    }

}

async function loadMyFeedback() {

    if (!currentUser) return;

    const feedbackQuery = query(
        collection(db, "courseFeedback"),
        where("userId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(feedbackQuery);

    myFeedback = [];

    snapshot.forEach((feedbackDoc) => {
        myFeedback.push({ id: feedbackDoc.id, ...feedbackDoc.data() });
    });

}

// =========================================================
// PROFILE SECTION — purchased courses + feedback given
// =========================================================

function renderProfileSection() {

    const purchasedList = $("#profilePurchasedList");
    const feedbackList = $("#profileFeedbackList");

    if (purchasedList) {

        if (!myCourses.length) {

            purchasedList.innerHTML = createEmptyState(
                "No purchases yet",
                "Courses you buy will be listed here."
            );

        } else {

            purchasedList.innerHTML = myCourses.map(course => {

                const price = course.price > 0
                    ? `Rs. ${Number(course.price).toLocaleString()}`
                    : "Free";

                return `
                    <div class="profile-list-item">
                        <div>
                            <div class="item-title">${escapeHTML(course.title || "Untitled Course")}</div>
                            <div class="item-sub">${price} • ${Number(course.progress || 0)}% complete</div>
                        </div>
                        <button
                            type="button"
                            class="feedback-button"
                            data-feedback-course-id="${escapeHTML(course.id)}"
                        >
                            Leave Feedback
                        </button>
                    </div>
                `;

            }).join("");

            purchasedList.querySelectorAll("[data-feedback-course-id]").forEach((button) => {
                button.addEventListener("click", () => {
                    const course = myCourses.find(item => item.id === button.dataset.feedbackCourseId);
                    if (course) openFeedbackModal(course);
                });
            });

        }

    }

    if (feedbackList) {

        if (!myFeedback.length) {

            feedbackList.innerHTML = createEmptyState(
                "No feedback yet",
                "Feedback you leave on paid courses will appear here."
            );

        } else {

            feedbackList.innerHTML = myFeedback.map(item => {

                const stars = "★".repeat(item.rating || 0) + "☆".repeat(5 - (item.rating || 0));
                const date = formatFirestoreDate(item.createdAt);

                return `
                    <div class="profile-list-item" style="align-items:flex-start;flex-direction:column;">
                        <div class="item-title">${escapeHTML(item.courseTitle || "Course")}</div>
                        <div class="item-stars">${stars}</div>
                        <p style="font-size:13px;margin:4px 0 0;">${escapeHTML(item.comment || "")}</p>
                        <div class="item-sub">${date}</div>
                    </div>
                `;

            }).join("");

        }

    }

}

// =========================================================
// RENDER ALL COURSES
// =========================================================

function renderAllCourses() {

    const grid = $("#allCoursesGrid");
    if (!grid) return;

    if (!allCourses.length) {
        grid.innerHTML = createEmptyState(
            "No courses available",
            "Courses will appear here when they are published."
        );
        return;
    }

    grid.innerHTML = allCourses.map(course => createCourseCard(course, false)).join("");
    initializeDynamicCourseButtons();

}

// =========================================================
// RENDER MY COURSES
// =========================================================

function renderMyCourses() {

    const grid = $("#myCoursesGrid");
    if (!grid) return;

    if (!myCourses.length) {
        grid.innerHTML = createEmptyState(
            "You haven't purchased any courses yet",
            "Browse all courses and start your learning journey."
        );
        return;
    }

    grid.innerHTML = myCourses.map(course => createCourseCard(course, true)).join("");
    initializeDynamicCourseButtons();

}

// =========================================================
// COURSE CARD
// =========================================================

function createCourseCard(course, enrolled) {

    const title = escapeHTML(course.title || "Untitled Course");
    const instructor = escapeHTML(course.instructor || "Learnify Instructor");
    const description = escapeHTML(course.description || "Start learning with Learnify.");
    const image = course.image || "assets/images/course-placeholder.jpg";
    const price = course.price !== undefined ? course.price : 0;
    const progress = Number(course.progress || 0);
    const buttonText = enrolled ? "Continue Learning" : "View Course";

    return `
        <article class="student-course-card" data-course-id="${escapeHTML(course.id)}" data-course-title="${title}">

            <div class="course-card-image">
                <img src="${escapeHTML(image)}" alt="${title}" loading="lazy" onerror="this.src='assets/images/course-placeholder.jpg'">
            </div>

            <div class="course-card-content">

                <span class="course-category">${escapeHTML(course.category || "Course")}</span>
                <h3>${title}</h3>
                <p>${description}</p>

                <div class="course-card-meta">
                    <span><i class="fa-solid fa-user"></i> ${instructor}</span>
                    <span><i class="fa-solid fa-book"></i> ${course.lessons || 0} Lessons</span>
                </div>

                ${
                    enrolled
                        ? `
                            <div class="course-progress">
                                <div class="progress-header"><span>Progress</span><strong>${progress}%</strong></div>
                                <div class="progress-bar"><span style="width:${progress}%"></span></div>
                            </div>
                        `
                        : ""
                }

                <div class="course-card-footer">
                    <strong class="course-price">
                        ${price > 0 ? `Rs. ${Number(price).toLocaleString()}` : "Free"}
                    </strong>
                    <button
                        type="button"
                        class="course-action-button"
                        data-course-id="${escapeHTML(course.id)}"
                        data-enrolled="${enrolled}"
                    >
                        ${buttonText}
                    </button>
                </div>

                ${
                    enrolled
                        ? `<button type="button" class="feedback-button" data-feedback-course-id="${escapeHTML(course.id)}">
                                <i class="fa-solid fa-star"></i> Leave Feedback
                           </button>`
                        : ""
                }

            </div>

        </article>
    `;

}

// =========================================================
// DYNAMIC COURSE BUTTONS
// =========================================================

function initializeDynamicCourseButtons() {

    $$(".course-action-button").forEach(button => {
        button.addEventListener("click", () => {
            const courseId = button.dataset.courseId;
            const enrolled = button.dataset.enrolled === "true";
            handleCourseAction(courseId, enrolled);
        });
    });

    $$("[data-feedback-course-id]").forEach(button => {
        // Skip ones already wired in renderProfileSection
        if (button.closest("#profilePurchasedList")) return;
        button.addEventListener("click", () => {
            const course = myCourses.find(item => item.id === button.dataset.feedbackCourseId);
            if (course) openFeedbackModal(course);
        });
    });

}

// =========================================================
// COURSE ACTION
// =========================================================

function handleCourseAction(courseId, enrolled) {

    const course = allCourses.find(item => item.id === courseId);
    if (!course) return;

    if (enrolled) {
        showAuthMessage(`Opening ${course.title}...`, "info");
        return;
    }

    showAuthMessage(`${course.title} selected. Payment system will be connected next.`, "info");

}

// =========================================================
// DASHBOARD STATS
// =========================================================

function updateDashboardStats() {

    const enrolledElement = $("#enrolledCourses");
    const completedElement = $("#completedCourses");

    if (enrolledElement) enrolledElement.textContent = myCourses.length;

    if (completedElement) {
        completedElement.textContent = myCourses.filter(
            course => Number(course.progress || 0) >= 100
        ).length;
    }

    // certificateCount is set inside renderCertificates()

}

// =========================================================
// NAVIGATION
// =========================================================

function initializeSidebar() {

    sidebarToggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        dashboardSidebar?.classList.toggle("open");
    });

    $$(".dashboard-nav-link").forEach(link => {

        link.addEventListener("click", (event) => {

            const section = link.dataset.dashboardSection;
            if (!section) return;

            // "All Courses" intentionally navigates to its own page.
            if (section === "all-courses" && link.tagName === "A" && link.getAttribute("href") !== "#all-courses") {
                return;
            }

            event.preventDefault();

            switchDashboardSection(section);

            $$(".dashboard-nav-link").forEach(item => item.classList.remove("active"));
            link.classList.add("active");

            if (window.innerWidth <= 800) {
                dashboardSidebar?.classList.remove("open");
            }

        });

    });

    $$("[data-dashboard-section]").forEach(el => {

        if (el.classList.contains("dashboard-nav-link")) return; // already handled above

        el.addEventListener("click", (event) => {
            const section = el.dataset.dashboardSection;
            if (!section) return;
            event.preventDefault();
            switchDashboardSection(section);
            activateNavigation(section);
        });

    });

}

// =========================================================
// SWITCH DASHBOARD SECTION
// =========================================================

function switchDashboardSection(section) {

    currentSection = section;

    const sections = [
        "dashboard", "all-courses", "my-courses", "payments",
        "meetings", "notifications", "certificates", "profile", "settings"
    ];

    sections.forEach(name => {

        const sectionId = getSectionId(name);
        const element = document.getElementById(sectionId);
        if (!element) return;

        if (name === section) {
            element.hidden = false;
            element.classList.add("active");
        } else {
            element.hidden = true;
            element.classList.remove("active");
        }

    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (section === "all-courses") renderAllCourses();
    if (section === "my-courses") renderMyCourses();
    if (section === "profile") renderProfileSection();
    if (section === "certificates") renderCertificates();
    if (section === "meetings") renderMeetings();

}

function getSectionId(section) {

    const map = {
        "dashboard": "dashboardSection",
        "all-courses": "allCoursesSection",
        "my-courses": "myCoursesSection",
        "payments": "paymentsSection",
        "meetings": "meetingsSection",
        "notifications": "notificationsSection",
        "certificates": "certificatesSection",
        "profile": "profileSection",
        "settings": "settingsSection"
    };

    return map[section] || "";

}

// =========================================================
// DASHBOARD
// =========================================================

function initializeDashboard() {

    if (dashboardYear) {
        dashboardYear.textContent = new Date().getFullYear();
    }

    logoutBtn?.addEventListener("click", logoutUser);
    dropdownLogout?.addEventListener("click", logoutUser);

}

// =========================================================
// ACTIVATE NAVIGATION
// =========================================================

function activateNavigation(section) {

    $$(".dashboard-nav-link").forEach(link => {
        link.classList.toggle("active", link.dataset.dashboardSection === section);
    });

}

// =========================================================
// SHOW DASHBOARD
// =========================================================

function showDashboard(user) {

    if (!authView || !dashboardView) return;

    updateUserInformation(user);

    authView.style.display = "none";
    dashboardView.hidden = false;

    document.body.classList.add("dashboard-active");

    switchDashboardSection("dashboard");

}

// =========================================================
// SHOW LOGIN
// =========================================================

function showLoginView() {

    if (dashboardView) dashboardView.hidden = true;
    if (authView) authView.style.display = "";

    document.body.classList.remove("dashboard-active");

}

// =========================================================
// UPDATE USER
// =========================================================

function updateUserInformation(user) {

    if (!user) return;

    const name = user.name || getNameFromEmail(user.email);
    const email = user.email || "student@example.com";

    if (dashboardUserName) dashboardUserName.textContent = name;
    if (welcomeUserName) welcomeUserName.textContent = getFirstName(name);
    if (dropdownUserName) dropdownUserName.textContent = name;
    if (dropdownUserEmail) dropdownUserEmail.textContent = email;

    const profilePageName = $("#profilePageName");
    const profilePageEmail = $("#profilePageEmail");
    const profilePageAvatar = $("#profilePageAvatar");

    if (profilePageName) profilePageName.textContent = name;
    if (profilePageEmail) profilePageEmail.textContent = email;
    if (profilePageAvatar) profilePageAvatar.textContent = getInitials(name);

    if (userAvatar) {
        if (user.photoURL) {
            userAvatar.innerHTML = `<img src="${escapeHTML(user.photoURL)}" alt="${escapeHTML(name)}">`;
        } else {
            userAvatar.textContent = getInitials(name);
        }
    }

}

// =========================================================
// LOGOUT
// =========================================================

async function logoutUser() {

    try {

        if (meetingsUnsubscribe) {
            meetingsUnsubscribe();
            meetingsUnsubscribe = null;
        }

        await signOut(auth);

        profileDropdown?.setAttribute("hidden", "");
        notificationPanel?.setAttribute("hidden", "");
        dashboardSidebar?.classList.remove("open");

        loginForm?.reset();
        registerForm?.reset();

        showAuthMode("login");

    } catch (error) {
        console.error("Logout error:", error);
    }

}

// =========================================================
// NOTIFICATIONS
// =========================================================

function initializeNotifications() {

    notificationButton?.addEventListener("click", event => {

        event.stopPropagation();
        profileDropdown?.setAttribute("hidden", "");

        if (notificationPanel) {
            notificationPanel.hidden = !notificationPanel.hidden;
        }

    });

    closeNotifications?.addEventListener("click", () => {
        notificationPanel?.setAttribute("hidden", "");
    });

    document.addEventListener("click", event => {

        if (
            notificationPanel &&
            !notificationPanel.contains(event.target) &&
            !notificationButton?.contains(event.target)
        ) {
            notificationPanel.hidden = true;
        }

    });

}

function addNotification(message) {

    notifications.unshift({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        createdAt: new Date()
    });

    renderNotifications();

}

function renderNotifications() {

    const dot = $("#notificationDot");
    const countElement = $("#notificationCount");
    const panelList = $("#notificationPanelList");
    const fullList = $("#notificationsList");

    if (countElement) countElement.textContent = notifications.length;

    if (dot) dot.hidden = notifications.length === 0;

    const markup = notifications.length
        ? notifications.map(item => `
            <div class="profile-list-item" style="align-items:flex-start;flex-direction:column;">
                <p style="margin:0;font-size:13px;">${escapeHTML(item.message)}</p>
                <div class="item-sub">${item.createdAt.toLocaleString()}</div>
            </div>
        `).join("")
        : `<div class="empty-state"><i class="fa-regular fa-bell"></i><p>No new notifications.</p></div>`;

    if (panelList) panelList.innerHTML = markup;
    if (fullList) fullList.innerHTML = markup;

}

// =========================================================
// PROFILE DROPDOWN
// =========================================================

function initializeProfileDropdown() {

    profileButton?.addEventListener("click", event => {

        event.stopPropagation();
        notificationPanel?.setAttribute("hidden", "");

        if (profileDropdown) {
            profileDropdown.hidden = !profileDropdown.hidden;
        }

    });

    document.addEventListener("click", event => {

        if (
            profileDropdown &&
            !profileDropdown.contains(event.target) &&
            !profileButton?.contains(event.target)
        ) {
            profileDropdown.hidden = true;
        }

    });

}

// =========================================================
// SEARCH
// =========================================================

function initializeSearch() {

    if (!courseSearch) return;

    courseSearch.addEventListener("input", () => {

        const searchQuery = courseSearch.value.trim().toLowerCase();

        $$(".student-course-card").forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = !searchQuery || text.includes(searchQuery) ? "" : "none";
        });

    });

}

// =========================================================
// FORGOT PASSWORD
// =========================================================

function initializeForgotPassword() {

    forgotPassword?.addEventListener("click", event => {

        event.preventDefault();

        if (forgotPasswordModal) forgotPasswordModal.hidden = false;

        setTimeout(() => { $("#forgotEmail")?.focus(); }, 100);

    });

    closeForgotModal?.addEventListener("click", closeForgotPasswordModal);

    forgotPasswordModal?.addEventListener("click", event => {
        if (event.target === forgotPasswordModal) closeForgotPasswordModal();
    });

    forgotPasswordForm?.addEventListener("submit", handleForgotPassword);

}

function closeForgotPasswordModal() {
    if (forgotPasswordModal) forgotPasswordModal.hidden = true;
}

async function handleForgotPassword(event) {

    event.preventDefault();

    const email = $("#forgotEmail")?.value.trim();

    if (!email || !isValidEmail(email)) {
        showTemporaryModalMessage("Please enter a valid email address.");
        return;
    }

    const button = forgotPasswordForm.querySelector(".auth-submit");
    setButtonLoading(button, true, "Sending...");

    try {

        await sendPasswordResetEmail(auth, email);
        showTemporaryModalMessage("If an account exists for this email, a password reset link has been sent.");
        forgotPasswordForm.reset();

    } catch (error) {
        console.error("Password reset error:", error);
        showTemporaryModalMessage("If an account exists for this email, a password reset link has been sent.");
    } finally {
        setButtonLoading(button, false);
    }

}

function showTemporaryModalMessage(message) {

    let messageBox = $("#modalMessage");

    if (!messageBox) {

        messageBox = document.createElement("div");
        messageBox.id = "modalMessage";
        messageBox.style.marginTop = "12px";
        messageBox.style.padding = "10px";
        messageBox.style.borderRadius = "8px";
        messageBox.style.background = "rgba(20, 184, 166, 0.08)";
        messageBox.style.color = "var(--primary)";
        messageBox.style.fontSize = "13px";
        messageBox.style.fontWeight = "600";

        forgotPasswordForm?.appendChild(messageBox);

    }

    messageBox.textContent = message;

}

// =========================================================
// PASSWORD CONTROLS
// =========================================================

function initializePasswordControls() {

    setupPasswordToggle(showLoginPassword, loginPassword);
    setupPasswordToggle(showRegisterPassword, registerPassword);
    setupPasswordToggle(showConfirmPassword, registerConfirmPassword);

}

function setupPasswordToggle(button, input) {

    if (!button || !input) return;

    button.addEventListener("click", () => {

        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";

        button.textContent = isPassword ? "🙈" : "👁";
        button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");

        input.focus();

    });

}

// =========================================================
// PASSWORD STRENGTH
// =========================================================

function initializePasswordStrength() {
    registerPassword?.addEventListener("input", updatePasswordStrength);
}

function updatePasswordStrength() {

    const password = registerPassword?.value || "";

    if (!password) {
        passwordStrength?.classList.remove("weak", "medium", "good", "strong");
        if (strengthText) strengthText.textContent = "Use 8+ characters";
        return;
    }

    let score = 0;

    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9!@#$%^&*]/.test(password)) score++;

    passwordStrength?.classList.remove("weak", "medium", "good", "strong");

    if (score <= 1) {
        passwordStrength?.classList.add("weak");
        if (strengthText) strengthText.textContent = "Weak password";
    } else if (score === 2) {
        passwordStrength?.classList.add("medium");
        if (strengthText) strengthText.textContent = "Medium password";
    } else if (score === 3) {
        passwordStrength?.classList.add("good");
        if (strengthText) strengthText.textContent = "Good password";
    } else {
        passwordStrength?.classList.add("strong");
        if (strengthText) strengthText.textContent = "Strong password";
    }

}

// =========================================================
// THEME
// =========================================================

function initializeTheme() {

    const savedTheme = localStorage.getItem("learnifyTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

}

// =========================================================
// KEYBOARD CONTROLS
// =========================================================

function initializeKeyboardControls() {

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            closeForgotPasswordModal();
            closeFeedbackModal();

            notificationPanel?.setAttribute("hidden", "");
            profileDropdown?.setAttribute("hidden", "");
            dashboardSidebar?.classList.remove("open");

        }

    });

}

// =========================================================
// VALIDATION
// =========================================================

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(inputId, message) {

    const input = $(`#${inputId}`);
    const error = $(`#${inputId}Error`);

    input?.classList.add("input-error");
    if (error) error.textContent = message;

}

function clearFormErrors() {

    $$(".input-error").forEach(input => input.classList.remove("input-error"));
    $$(".field-error").forEach(error => { error.textContent = ""; });

}

// =========================================================
// AUTH MESSAGES
// =========================================================

function showAuthMessage(message, type = "info") {

    if (!authMessage) return;

    authMessage.textContent = message;
    authMessage.className = `auth-message show ${type}`;

}

function clearAuthMessage() {

    if (!authMessage) return;

    authMessage.textContent = "";
    authMessage.className = "auth-message";

}

// =========================================================
// FIREBASE ERROR MESSAGES
// =========================================================

function getFriendlyAuthErrorMessage(error) {

    switch (error?.code) {

        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Your current password is incorrect.";

        case "auth/requires-recent-login":
            return "For security, please log out and back in, then try again.";

        case "auth/email-already-in-use":
            return "That email address is already in use by another account.";

        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/weak-password":
            return "Your password must contain at least 8 characters.";

        case "auth/network-request-failed":
            return "Network error. Please check your internet connection.";

        default:
            return `${error?.code || "Firebase error"}: ${error?.message || "Unknown error"}`;

    }

}

function showAuthError(error) {

    console.error("Firebase Error:", error);

    let message = "Something went wrong. Please try again.";

    switch (error?.code) {

        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            message = "Incorrect email or password.";
            break;

        case "auth/email-already-in-use":
            message = "An account already exists with this email.";
            break;

        case "auth/weak-password":
            message = "Your password must contain at least 8 characters.";
            break;

        case "auth/invalid-email":
            message = "Please enter a valid email address.";
            break;

        case "auth/popup-closed-by-user":
            message = "Google sign-in was cancelled.";
            break;

        case "auth/popup-blocked":
            message = "Your browser blocked the Google sign-in popup.";
            break;

        case "auth/unauthorized-domain":
            message = "This website domain is not authorized in Firebase.";
            break;

        case "auth/operation-not-allowed":
            message = "This sign-in method is not enabled in Firebase.";
            break;

        case "auth/network-request-failed":
            message = "Network error. Please check your internet connection.";
            break;

        case "auth/configuration-not-found":
            message = "Firebase Authentication is not configured correctly.";
            break;

        case "auth/too-many-requests":
            message = "Too many attempts. Please wait and try again.";
            break;

        default:
            message = `${error?.code || "Firebase error"}: ${error?.message || "Unknown error"}`;
            break;

    }

    showAuthMessage(message, "error");

}

// =========================================================
// BUTTON LOADING
// =========================================================

function setButtonLoading(button, loading, loadingText) {

    if (!button) return;

    if (loading) {

        button.dataset.originalText = button.innerHTML;
        button.classList.add("loading");
        button.disabled = true;

        button.innerHTML = `
            <span>${loadingText}</span>
            <span class="button-spinner">◌</span>
        `;

    } else {

        button.classList.remove("loading");
        button.disabled = false;

        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
        }

    }

}

// =========================================================
// EMPTY STATE
// =========================================================

function createEmptyState(title, message) {

    return `
        <div class="dashboard-empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-book-open"></i></div>
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(message)}</p>
        </div>
    `;

}

// =========================================================
// DATE HELPERS
// =========================================================

function formatFirestoreDate(value, includeTime = false) {

    let dateObj = null;

    if (value?.toDate) {
        dateObj = value.toDate();
    } else if (value instanceof Date) {
        dateObj = value;
    }

    if (!dateObj) return "—";

    return includeTime
        ? dateObj.toLocaleString()
        : dateObj.toLocaleDateString();

}

// =========================================================
// USER HELPERS
// =========================================================

function getNameFromEmail(email) {

    if (!email) return "Student";

    const username = email.split("@")[0];

    return username
        .replace(/[.\_-]+/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());

}

function getFirstName(name) {

    if (!name) return "Student";

    return name.trim().split(/\s+/)[0];

}

function getInitials(name) {

    if (!name) return "S";

    const parts = name.trim().split(/\s+/);

    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }

    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();

}

// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

// =========================================================
// EMPTY HASH LINKS
// =========================================================

$$('a[href="#"]').forEach(link => {
    link.addEventListener("click", event => event.preventDefault());
});

// =========================================================
// RESPONSIVE RESET
// =========================================================

window.addEventListener("resize", () => {
    if (window.innerWidth > 800) {
        dashboardSidebar?.classList.remove("open");
    }
});

// =========================================================
// DEBUG
// =========================================================

console.log(
    "%c Learnify Student Panel ",
    "background:#0F766E;color:white;padding:6px 10px;border-radius:5px;font-weight:bold;"
);

console.log("Firebase authentication + student dashboard loaded.");