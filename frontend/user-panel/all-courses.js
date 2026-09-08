/* =========================================================
   LEARNIFY — ALL COURSES
   Firebase / Firestore Connected JavaScript

   Firestore ONLY — No Default Courses
   Same Firebase Project / Same User Session

   IMPORTANT:
   - Only ONE loadCoursesFromFirebase() function
   - Supports existing Firestore field names
   - Reads /courses directly
   - Supports Img image field
   - Supports reviews
   - Supports wishlist
   - Supports search
   - Supports course modal
   - Supports login requirement
   - Supports payment page

   FIXES APPLIED (see chat for explanation):
   1. firstValue() now normalizes field names (trim + lowercase)
      before matching, so stray whitespace or case differences
      in Firestore field names (e.g. "title ") no longer cause
      fallback values like "Untitled Course" to be used.
   2. getCourseImage() now checks "Image" before the legacy
      "Img" field, so a bogus/misused "Img" value (e.g. a
      rating typed into the wrong field) no longer overrides
      the real image URL.
   ========================================================= */

"use strict";


/* =========================================================
   FIREBASE IMPORTS
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIGURATION
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyCgpGk9aHFdVeGoE2rwiUPPWSkfQmTvuIo",

    authDomain:
        "nextwave-commerce-project.firebaseapp.com",

    projectId:
        "nextwave-commerce-project",

    storageBucket:
        "nextwave-commerce-project.firebasestorage.app",

    messagingSenderId:
        "599878226058",

    appId:
        "1:599878226058:web:b7221d2c100b94f58add73",

    measurementId:
        "G-62RWSW54NG"
};


/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

let firebaseApp = null;
let auth = null;
let db = null;
let firebaseReady = false;

try {

    firebaseApp =
        initializeApp(firebaseConfig);

    auth =
        getAuth(firebaseApp);

    db =
        getFirestore(firebaseApp);

    firebaseReady = true;

    console.log(
        "===================================="
    );

    console.log(
        "LEARNIFY FIREBASE INITIALIZED"
    );

    console.log(
        "Project:",
        firebaseConfig.projectId
    );

    console.log(
        "===================================="
    );

} catch (error) {

    console.error(
        "FIREBASE INITIALIZATION FAILED:",
        error
    );

    console.error(
        "Firebase error code:",
        error?.code
    );

    console.error(
        "Firebase error message:",
        error?.message
    );
}


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (selector) =>
    document.querySelector(selector);

const $$ = (selector) =>
    document.querySelectorAll(selector);


/* =========================================================
   DOM ELEMENTS
========================================================= */

const backButton =
    $("#backButton");

const courseSearch =
    $("#courseSearch");

const myCoursesButton =
    $("#myCoursesButton");

const profileButton =
    $("#profileButton");

const profileAvatar =
    $("#profileAvatar");

const profileName =
    $("#profileName");

const coursesGrid =
    $("#coursesGrid");

const courseCount =
    $("#courseCount");

const noCourses =
    $("#noCourses");

const noResults =
    $("#noResults");


/* =========================================================
   COURSE MODAL ELEMENTS
========================================================= */

const courseModal =
    $("#courseModal");

const closeCourseModal =
    $("#closeCourseModal");

const modalCourseImage =
    $("#modalCourseImage");

const modalCourseCategory =
    $("#modalCourseCategory");

const modalCourseTitle =
    $("#modalCourseTitle");

const modalCourseDescription =
    $("#modalCourseDescription");

const modalLessons =
    $("#modalLessons");

const modalDuration =
    $("#modalDuration");

const modalInstructor =
    $("#modalInstructor");

const averageRating =
    $("#averageRating");

const averageStars =
    $("#averageStars");

const feedbackList =
    $("#feedbackList");

const noFeedback =
    $("#noFeedback");

const modalCoursePrice =
    $("#modalCoursePrice");

const buyNowButton =
    $("#buyNowButton");


/* =========================================================
   LOGIN REQUIRED MODAL
========================================================= */

const loginRequiredModal =
    $("#loginRequiredModal");

const closeLoginModal =
    $("#closeLoginRequiredModal") ||
    $("#closeLoginModal");

const cancelLoginRequired =
    $("#cancelLoginRequired");

const goToLoginButton =
    $("#goToLoginButton");


/* =========================================================
   TOAST
========================================================= */

const toast =
    $("#toast");

const toastIcon =
    $("#toastIcon");

const toastMessage =
    $("#toastMessage");


/* =========================================================
   APPLICATION STATE
========================================================= */

let allCourses = [];

let filteredCourses = [];

let currentCourse = null;

let currentUser = null;

let feedbackRequestId = 0;


/* =========================================================
   SHOW TOAST
========================================================= */

function showToast(
    message,
    type = "success"
) {

    if (
        !toast ||
        !toastMessage
    ) {
        return;
    }

    toastMessage.textContent =
        message;

    if (toastIcon) {

        toastIcon.className =
            type === "error"
                ? "fa-solid fa-circle-exclamation"
                : "fa-solid fa-circle-check";
    }

    toast.classList.remove(
        "show",
        "success",
        "error"
    );

    toast.classList.add(
        "show",
        type
    );

    clearTimeout(
        window.learnifyToastTimer
    );

    window.learnifyToastTimer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 3500);
}


/* =========================================================
   FORMAT PRICE
========================================================= */

function formatPrice(price) {

    const numericPrice =
        Number(price) || 0;

    return `Rs. ${numericPrice.toLocaleString("en-PK")}`;
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   GET FIRST VALID VALUE

   This solves Firestore field-name differences.

   FIX: field names are matched after trimming whitespace and
   lowercasing, both on the requested field list and on the
   actual keys present in the document. This means a Firestore
   field named "title " (trailing space) or "TITLE" will still
   match a lookup for "title", which was the likely cause of
   titles/other fields silently falling back to their default
   values even though the data looked correct in the console.
========================================================= */

function firstValue(
    data,
    fields,
    fallback = ""
) {

    if (!data) {
        return fallback;
    }

    /* Build a normalized key map once per call:
       trimmed+lowercased key -> original value */
    const normalized = {};

    for (const key in data) {

        if (!Object.prototype.hasOwnProperty.call(data, key)) {
            continue;
        }

        const normalizedKey =
            key.trim().toLowerCase();

        /* Don't let an empty/whitespace-only normalized value
           already stored under this key overwrite a real one */
        if (
            normalized[normalizedKey] !== undefined &&
            String(normalized[normalizedKey]).trim() !== ""
        ) {
            continue;
        }

        normalized[normalizedKey] =
            data[key];
    }

    for (
        const field of fields
    ) {

        const normalizedField =
            String(field).trim().toLowerCase();

        const value =
            normalized[normalizedField];

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {

            return value;
        }
    }

    return fallback;
}


/* =========================================================
   GET COURSE IMAGE

   FIX: "Image" (the real field on your Firestore documents)
   is now checked BEFORE the legacy "Img" field. Previously
   "Img" was checked first, so a stray/incorrect value stored
   under "Img" (e.g. a rating typed into the wrong field)
   would silently win over the real image URL stored in
   "Image", causing the course image to fail to load.

   "Img" is kept at the end purely as a legacy fallback for
   any older documents that only ever used that field name.
========================================================= */

function getCourseImage(course) {

    if (!course) {
        return "";
    }

    const image =
        firstValue(
            course,
            [
                "Image",
                "image",
                "imageUrl",
                "ImageUrl",
                "imageURL",
                "thumbnail",
                "Thumbnail",
                "thumbnailUrl",
                "photo",
                "photoUrl",
                "courseImage",
                "courseImageUrl",
                "Img",
                "img"
            ],
            ""
        );

    return String(image).trim();
}


/* =========================================================
   GET COURSE THEME
========================================================= */

function getCourseTheme(course) {

    const title =
        String(
            course?.title || ""
        ).toLowerCase();

    const category =
        String(
            course?.category || ""
        ).toLowerCase();

    if (
        title.includes("ebay") ||
        category.includes("ebay")
    ) {

        return "ebay-course";
    }

    if (
        title.includes("advanced") &&
        title.includes("etsy")
    ) {

        return "etsy-advanced-course";
    }

    if (
        title.includes("etsy") ||
        category.includes("etsy")
    ) {

        return "etsy-course";
    }

    return "";
}


/* =========================================================
   GET STAR HTML
========================================================= */

function getStars(rating) {

    const value =
        Number(rating) || 0;

    let stars = "";

    for (
        let i = 1;
        i <= 5;
        i++
    ) {

        if (value >= i) {

            stars += "★";

        } else {

            stars += "☆";
        }
    }

    return stars;
}


/* =========================================================
   FIREBASE ERROR HELPER
========================================================= */

function logFirebaseError(
    title,
    error
) {

    console.error(
        `========== ${title} ==========`
    );

    console.error(
        "Full error:",
        error
    );

    console.error(
        "Error code:",
        error?.code || "unknown"
    );

    console.error(
        "Error message:",
        error?.message || "No message"
    );

    console.error(
        "Error name:",
        error?.name || "UnknownError"
    );

    console.error(
        "===================================="
    );
}


/* =========================================================
   NORMALIZE FIRESTORE COURSE
========================================================= */

function normalizeCourse(
    courseDoc
) {

    const data =
        courseDoc.data();

    console.log(
        "------------------------------------"
    );

    console.log(
        "RAW FIRESTORE DOCUMENT"
    );

    console.log(
        "Document ID:",
        courseDoc.id
    );

    console.log(
        "Document data:",
        data
    );


    /* =====================================================
       TITLE

       Supports:
       title
       Title
       courseTitle
       CourseTitle
       courseName
       CourseName
       course_title
       course_name
       name
       Name
    ===================================================== */

    const title =
        firstValue(
            data,
            [
                "title",
                "Title",
                "courseTitle",
                "CourseTitle",
                "courseName",
                "CourseName",
                "course_title",
                "course_name",
                "name",
                "Name"
            ],
            "Untitled Course"
        );


    /* =====================================================
       DESCRIPTION
    ===================================================== */

    const description =
        firstValue(
            data,
            [
                "description",
                "Description",
                "courseDescription",
                "CourseDescription",
                "course_description",
                "details",
                "Details",
                "summary",
                "Summary"
            ],
            "Learn valuable practical skills with Learnify."
        );


    /* =====================================================
       CATEGORY
    ===================================================== */

    const category =
        firstValue(
            data,
            [
                "category",
                "Category",
                "courseCategory",
                "CourseCategory",
                "course_category"
            ],
            "Course"
        );


    /* =====================================================
       PROVIDER
    ===================================================== */

    const provider =
        firstValue(
            data,
            [
                "provider",
                "Provider",
                "platform",
                "Platform"
            ],
            "Learnify"
        );


    /* =====================================================
       INSTRUCTOR
    ===================================================== */

    const instructor =
        firstValue(
            data,
            [
                "instructor",
                "Instructor",
                "teacher",
                "Teacher",
                "trainer",
                "Trainer",
                "author",
                "Author"
            ],
            "Learnify"
        );


    /* =====================================================
       PRICE
    ===================================================== */

    const rawPrice =
        firstValue(
            data,
            [
                "price",
                "Price",
                "coursePrice",
                "CoursePrice",
                "course_price",
                "amount",
                "Amount"
            ],
            0
        );

    const price =
        Number(rawPrice) || 0;


    /* =====================================================
       LESSONS
    ===================================================== */

    const rawLessons =
        firstValue(
            data,
            [
                "lessons",
                "Lessons",
                "lessonCount",
                "LessonCount",
                "lesson_count",
                "numberOfLessons",
                "NumberOfLessons"
            ],
            0
        );

    const lessons =
        Number(rawLessons) || 0;


    /* =====================================================
       DURATION
    ===================================================== */

        const rawDuration =
        firstValue(
            data,
            [
                "duration",
                "Duration",
                "courseDuration",
                "CourseDuration",
                "course_duration"
            ],
            ""
        );

    const duration =
        rawDuration === ""
            ? "—"
            : /^\d+$/.test(String(rawDuration).trim())
                ? `${rawDuration} days`
                : rawDuration;


    /* =====================================================
       RATING
    ===================================================== */

    const rawRating =
        firstValue(
            data,
            [
                "rating",
                "Rating",
                "averageRating",
                "AverageRating",
                "average_rating"
            ],
            0
        );

    const rating =
        Number(rawRating) || 0;


    /* =====================================================
       REVIEW COUNT
    ===================================================== */

    const rawReviewCount =
        firstValue(
            data,
            [
                "reviewCount",
                "ReviewCount",
                "reviewsCount",
                "ReviewsCount",
                "review_count",
                "reviews"
            ],
            0
        );

    const reviewCount =
        Number(rawReviewCount) || 0;


    /* =====================================================
       IMAGE
    ===================================================== */

    const image =
        getCourseImage(data);


    /* =====================================================
       ACTIVE

       IMPORTANT:
       If active does not exist, course is considered active.
       This prevents an existing course from disappearing.
    ===================================================== */

    const active =
        data.active === undefined &&
        data.Active === undefined

            ? true

            : (
                data.active === true ||
                data.Active === true
            );


    /* =====================================================
       NORMALIZED COURSE
    ===================================================== */

    const course = {

        id:
            courseDoc.id,

        /* Keep original Firestore fields */
        ...data,

        /* Normalized fields */
        title:
            String(title).trim(),

        description:
            String(description).trim(),

        category:
            String(category).trim(),

        provider:
            String(provider).trim(),

        instructor:
            String(instructor).trim(),

        image:
            String(image).trim(),

        price,

        lessons,

        duration:
            String(duration).trim(),

        rating,

        reviewCount,

        active
    };


    console.log(
        "NORMALIZED COURSE:",
        course
    );

    console.log(
        "FINAL TITLE:",
        course.title
    );

    console.log(
        "FINAL IMAGE:",
        course.image
    );

    console.log(
        "FINAL PRICE:",
        course.price
    );

    return course;
}


/* =========================================================
   LOAD COURSES FROM FIRESTORE

   ONLY ONE FUNCTION
========================================================= */

async function loadCoursesFromFirebase() {

    if (
        !firebaseReady ||
        !db
    ) {

        console.error(
            "Firebase is not ready."
        );

        showToast(
            "Firebase is not ready.",
            "error"
        );

        return [];
    }


    try {

        console.log(
            "===================================="
        );

        console.log(
            "LOADING COURSES FROM FIRESTORE"
        );

        console.log(
            "Collection: /courses"
        );

        console.log(
            "===================================="
        );


        const startTime =
            performance.now();


        /* =================================================
           COLLECTION
        ================================================= */

        const coursesRef =
            collection(
                db,
                "courses"
            );


        /* =================================================
           LOAD ALL DOCUMENTS

           No active filter.
           No orderBy.
           No index requirement.
        ================================================= */

        const snapshot =
            await getDocs(
                coursesRef
            );


        const endTime =
            performance.now();


        console.log(
            `Firestore query completed in ${(endTime - startTime).toFixed(2)} ms`
        );

        console.log(
            "Firestore documents returned:",
            snapshot.size
        );


        /* =================================================
           EMPTY
        ================================================= */

        if (
            snapshot.empty
        ) {

            console.warn(
                "NO DOCUMENTS FOUND IN /courses"
            );

            return [];
        }


        /* =================================================
           NORMALIZE
        ================================================= */

        const courses =
            snapshot.docs
                .map(
                    normalizeCourse
                );


        console.log(
            "===================================="
        );

        console.log(
            "ALL NORMALIZED COURSES:",
            courses
        );

        console.log(
            "TOTAL COURSES:",
            courses.length
        );

        console.log(
            "===================================="
        );


        return courses;


    } catch (error) {

        logFirebaseError(
            "LOAD COURSES FROM FIRESTORE FAILED",
            error
        );

        showToast(
            "Unable to load courses from Firebase.",
            "error"
        );

        return [];
    }
}


/* =========================================================
   INITIAL COURSE LOAD
========================================================= */

async function initializeCourses() {

    console.log(
        "Initializing Firestore courses..."
    );


    allCourses = [];

    filteredCourses = [];


    /* Render empty state first */
    renderCourses();


    const courses =
        await loadCoursesFromFirebase();


    allCourses =
        Array.isArray(courses)
            ? courses
            : [];


    filteredCourses =
        [...allCourses];


    console.log(
        "All courses after Firebase load:",
        allCourses
    );


    console.log(
        "Course count:",
        allCourses.length
    );


    renderCourses();


    updateWishlistButtons();


    if (
        allCourses.length === 0
    ) {

        console.warn(
            "No courses available to display."
        );

    } else {

        console.log(
            "Courses successfully loaded into Learnify."
        );
    }
}


/* =========================================================
   RENDER COURSES
========================================================= */

function renderCourses() {

    if (!coursesGrid) {

        console.error(
            "ERROR: #coursesGrid was not found."
        );

        return;
    }


    coursesGrid.innerHTML =
        "";


    const hasCourses =
        allCourses.length > 0;


    const hasFilteredCourses =
        filteredCourses.length > 0;


    /* =================================================
       COURSE COUNT
    ================================================= */

    if (courseCount) {

        courseCount.textContent =
            filteredCourses.length;
    }


    /* =================================================
       NO COURSES
    ================================================= */

    if (!hasCourses) {

        if (noCourses) {

            noCourses.hidden =
                false;

            noCourses.textContent =
                "No courses available.";
        }


        if (noResults) {

            noResults.hidden =
                true;
        }


        return;
    }


    /* =================================================
       NO SEARCH RESULTS
    ================================================= */

    if (!hasFilteredCourses) {

        if (noCourses) {

            noCourses.hidden =
                true;
        }


        if (noResults) {

            noResults.hidden =
                false;

            noResults.textContent =
                "No courses match your search.";
        }


        return;
    }


    /* =================================================
       HIDE EMPTY STATES
    ================================================= */

    if (noCourses) {

        noCourses.hidden =
            true;
    }


    if (noResults) {

        noResults.hidden =
            true;
    }


    /* =================================================
       CREATE CARDS
    ================================================= */

    filteredCourses.forEach(
        (course) => {

            console.log(
                "Rendering course card:",
                course.id,
                course.title
            );


            const card =
                createCourseCard(
                    course
                );


            coursesGrid.appendChild(
                card
            );
        }
    );


    console.log(
        `Rendered ${filteredCourses.length} course card(s).`
    );
}


/* =========================================================
   CREATE COURSE CARD
========================================================= */

function createCourseCard(course) {

    const article =
        document.createElement(
            "article"
        );


    article.className =
        "all-course-card";


    article.dataset.courseId =
        course.id;


    const image =
        getCourseImage(
            course
        );


    const theme =
        getCourseTheme(
            course
        );


    const rating =
        Number(
            course.rating
        ) || 0;


    const safeImage =
        escapeHTML(
            image
        );


    const title =
        String(
            course.title ||
            "Untitled Course"
        ).trim();


    const category =
        String(
            course.category ||
            "Course"
        ).trim();


    const provider =
        String(
            course.provider ||
            "NextWave Commerce"
        ).trim();


    const description =
        String(
            course.description ||
            "Learn practical skills with Learnify."
        ).trim();


    const lessons =
        Number(
            course.lessons
        ) || 0;


    const duration =
        String(
            course.duration ||
            "—"
        ).trim();


    const price =
        Number(
            course.price
        ) || 0;


    article.innerHTML = `

        <div class="course-card-image ${escapeHTML(theme)}">

            ${
                safeImage
                    ? `
                        <img
                            src="${safeImage}"
                            alt="${escapeHTML(title)}"
                            loading="lazy"
                            onerror="
                                this.style.display='none';
                            "
                        >
                    `
                    : ""
            }


            <span class="course-badge">
                ${escapeHTML(category)}
            </span>


            <button
                type="button"
                class="course-wishlist"
                aria-label="Add to wishlist"
                data-wishlist-id="${escapeHTML(course.id)}"
            >

                <i class="fa-regular fa-heart"></i>

            </button>

        </div>


        <div class="all-course-body">

            <span class="course-provider">
                ${escapeHTML(provider)}
            </span>


            <h3 class="course-title">
                ${escapeHTML(title)}
            </h3>


            <p class="course-description">
                ${escapeHTML(description)}
            </p>


            <div class="course-rating">

                <span class="rating-stars">
                    ${getStars(rating)}
                </span>


                <span class="rating-number">
                    ${rating.toFixed(1)}
                </span>


                <span class="rating-count">
                    (${Number(course.reviewCount) || 0})
                </span>

            </div>


            <div class="course-meta">

                <span class="course-meta-item">

                    <i class="fa-solid fa-book"></i>

                    ${lessons}
                    Lessons

                </span>


                <span class="course-meta-item">

                    <i class="fa-solid fa-clock"></i>

                    ${escapeHTML(duration)}

                </span>

            </div>


            <div class="course-card-footer">

                <div class="course-price">

                    ${formatPrice(price)}

                </div>


                <button
                    type="button"
                    class="view-course-button"
                    data-course-id="${escapeHTML(course.id)}"
                >

                    View Course

                    <i class="fa-solid fa-arrow-right"></i>

                </button>

            </div>

        </div>
    `;


    return article;
}


/* =========================================================
   COURSE GRID CLICK
========================================================= */

function handleCourseGridClick(event) {

    const wishlistButton =
        event.target.closest(
            ".course-wishlist"
        );


    if (wishlistButton) {

        event.stopPropagation();


        toggleWishlist(
            wishlistButton.dataset.wishlistId
        );


        return;
    }


    const viewButton =
        event.target.closest(
            ".view-course-button"
        );


    if (!viewButton) {
        return;
    }


    const courseId =
        viewButton.dataset.courseId;


    openCourseModal(
        courseId
    );
}


/* =========================================================
   WISHLIST
========================================================= */

function toggleWishlist(courseId) {

    if (!courseId) {
        return;
    }


    const key =
        "learnify_wishlist";


    let wishlist = [];


    try {

        wishlist =
            JSON.parse(
                localStorage.getItem(
                    key
                )
            ) || [];

    } catch {

        wishlist = [];
    }


    const index =
        wishlist.indexOf(
            courseId
        );


    if (index === -1) {

        wishlist.push(
            courseId
        );


        showToast(
            "Course added to wishlist."
        );

    } else {

        wishlist.splice(
            index,
            1
        );


        showToast(
            "Course removed from wishlist."
        );
    }


    localStorage.setItem(
        key,
        JSON.stringify(
            wishlist
        )
    );


    updateWishlistButtons();
}


/* =========================================================
   UPDATE WISHLIST BUTTONS
========================================================= */

function updateWishlistButtons() {

    let wishlist = [];


    try {

        wishlist =
            JSON.parse(
                localStorage.getItem(
                    "learnify_wishlist"
                )
            ) || [];

    } catch {

        wishlist = [];
    }


    $$(".course-wishlist")
        .forEach(
            (button) => {

                const id =
                    button.dataset.wishlistId;


                const icon =
                    button.querySelector(
                        "i"
                    );


                if (!icon) {
                    return;
                }


                if (
                    wishlist.includes(id)
                ) {

                    icon.className =
                        "fa-solid fa-heart";


                    button.classList.add(
                        "active"
                    );

                } else {

                    icon.className =
                        "fa-regular fa-heart";


                    button.classList.remove(
                        "active"
                    );
                }
            }
        );
}


/* =========================================================
   SEARCH COURSES
========================================================= */

function searchCourses() {

    const search =
        String(
            courseSearch?.value || ""
        )
            .trim()
            .toLowerCase();


    if (!search) {

        filteredCourses =
            [...allCourses];


        renderCourses();


        return;
    }


    filteredCourses =
        allCourses.filter(
            (course) => {

                const text = [

                    course.title,

                    course.description,

                    course.category,

                    course.provider,

                    course.instructor

                ]
                    .join(" ")
                    .toLowerCase();


                return text.includes(
                    search
                );
            }
        );


    renderCourses();
}


/* =========================================================
   OPEN COURSE MODAL
========================================================= */

async function openCourseModal(
    courseId
) {

    const course =
        allCourses.find(
            (item) =>
                String(item.id) ===
                String(courseId)
        );


    if (!course) {

        showToast(
            "Course could not be found.",
            "error"
        );


        return;
    }


    currentCourse =
        course;


    fillCourseModal(
        course
    );


    if (courseModal) {

        courseModal.hidden =
            false;


        document.body.classList.add(
            "modal-open"
        );
    }


    await loadCourseFeedback(
        course.id
    );
}


/* =========================================================
   FILL COURSE MODAL
========================================================= */

function fillCourseModal(course) {

    if (modalCourseImage) {

        const image =
            getCourseImage(
                course
            );


        if (image) {

            modalCourseImage.src =
                image;


            modalCourseImage.alt =
                course.title ||
                "Course";


            modalCourseImage.style.display =
                "";

        } else {

            modalCourseImage.removeAttribute(
                "src"
            );


            modalCourseImage.style.display =
                "none";
        }
    }


    if (modalCourseCategory) {

        modalCourseCategory.textContent =
            course.category ||
            "Course";
    }


    if (modalCourseTitle) {

        modalCourseTitle.textContent =
            course.title ||
            "Course";
    }


    if (modalCourseDescription) {

        modalCourseDescription.textContent =
            course.description ||
            "Learn practical skills with Learnify.";
    }


    if (modalLessons) {

        modalLessons.textContent =
            Number(
                course.lessons
            ) || 0;
    }


    if (modalDuration) {

        modalDuration.textContent =
            course.duration ||
            "—";
    }


    if (modalInstructor) {

        modalInstructor.textContent =
            course.instructor ||
            "Learnify";
    }


    if (modalCoursePrice) {

        modalCoursePrice.textContent =
            formatPrice(
                course.price
            );
    }


    updateAverageRating(
        Number(course.rating) || 0
    );
}


/* =========================================================
   CLOSE COURSE MODAL
========================================================= */

function closeCourseDetailsModal() {

    if (!courseModal) {
        return;
    }


    courseModal.hidden =
        true;


    document.body.classList.remove(
        "modal-open"
    );


    currentCourse =
        null;
}


/* =========================================================
   LOAD COURSE FEEDBACK
========================================================= */

async function loadCourseFeedback(
    courseId
) {

    if (!feedbackList) {
        return;
    }


    const requestId =
        ++feedbackRequestId;


    feedbackList.innerHTML =
        "";


    if (noFeedback) {

        noFeedback.hidden =
            true;
    }


    if (
        !firebaseReady ||
        !db
    ) {

        showNoFeedback();

        return;
    }


    try {

        const reviewsRef =
            collection(
                db,
                "courses",
                courseId,
                "reviews"
            );


        const reviewsQuery =
            query(
                reviewsRef,
                orderBy(
                    "createdAt",
                    "desc"
                ),
                limit(50)
            );


        console.log(
            `Loading reviews for course: ${courseId}`
        );


        const snapshot =
            await getDocs(
                reviewsQuery
            );


        if (
            requestId !==
            feedbackRequestId
        ) {

            return;
        }


        console.log(
            `Reviews returned: ${snapshot.size}`
        );


        if (
            snapshot.empty
        ) {

            showNoFeedback();

            return;
        }


        const reviews =
            snapshot.docs.map(
                (reviewDoc) => ({

                    id:
                        reviewDoc.id,

                    ...reviewDoc.data()

                })
            );


        renderFeedback(
            reviews
        );


    } catch (error) {

        logFirebaseError(
            "ORDERED REVIEW QUERY FAILED",
            error
        );


        try {

            console.warn(
                "Trying fallback review query..."
            );


            const reviewsRef =
                collection(
                    db,
                    "courses",
                    courseId,
                    "reviews"
                );


            const fallbackQuery =
                query(
                    reviewsRef,
                    limit(50)
                );


            const snapshot =
                await getDocs(
                    fallbackQuery
                );


            if (
                requestId !==
                feedbackRequestId
            ) {

                return;
            }


            if (
                snapshot.empty
            ) {

                showNoFeedback();

                return;
            }


            const reviews =
                snapshot.docs.map(
                    (reviewDoc) => ({

                        id:
                            reviewDoc.id,

                        ...reviewDoc.data()

                    })
                );


            renderFeedback(
                reviews
            );


        } catch (fallbackError) {

            logFirebaseError(
                "FALLBACK REVIEW QUERY FAILED",
                fallbackError
            );


            showNoFeedback();
        }
    }
}


/* =========================================================
   RENDER FEEDBACK
========================================================= */

function renderFeedback(
    reviews
) {

    if (!feedbackList) {
        return;
    }


    feedbackList.innerHTML =
        "";


    if (!reviews.length) {

        showNoFeedback();

        return;
    }


    if (noFeedback) {

        noFeedback.hidden =
            true;
    }


    let totalRating =
        0;


    reviews.forEach(
        (review) => {

            const rating =
                Number(
                    review.rating
                ) || 0;


            totalRating +=
                rating;


            const card =
                createFeedbackCard(
                    review
                );


            feedbackList.appendChild(
                card
            );
        }
    );


    const average =
        totalRating /
        reviews.length;


    updateAverageRating(
        average
    );
}


/* =========================================================
   CREATE FEEDBACK CARD
========================================================= */

function createFeedbackCard(
    review
) {

    const article =
        document.createElement(
            "article"
        );


    article.className =
        "feedback-card";


    const name =
        review.userName ||
        review.name ||
        review.studentName ||
        "Learnify Student";


    const comment =
        review.comment ||
        review.feedback ||
        review.message ||
        "Great course!";


    const rating =
        Number(
            review.rating
        ) || 0;


    const initial =
        String(name)
            .trim()
            .charAt(0)
            .toUpperCase() ||
        "S";


    article.innerHTML = `

        <div class="feedback-top">

            <div class="feedback-user">

                <div class="feedback-avatar">

                    ${escapeHTML(initial)}

                </div>


                <div>

                    <strong>
                        ${escapeHTML(name)}
                    </strong>


                    <div class="feedback-stars">

                        ${getStars(rating)}

                    </div>

                </div>

            </div>


            <span class="feedback-rating">

                ${rating.toFixed(1)}

            </span>

        </div>


        <p class="feedback-comment">

            ${escapeHTML(comment)}

        </p>

    `;


    return article;
}


/* =========================================================
   SHOW NO FEEDBACK
========================================================= */

function showNoFeedback() {

    if (feedbackList) {

        feedbackList.innerHTML =
            "";
    }


    if (noFeedback) {

        noFeedback.hidden =
            false;
    }


    updateAverageRating(
        0
    );
}


/* =========================================================
   UPDATE AVERAGE RATING
========================================================= */

function updateAverageRating(
    rating
) {

    const value =
        Number(rating) || 0;


    if (averageRating) {

        averageRating.textContent =
            value.toFixed(1);
    }


    if (averageStars) {

        averageStars.textContent =
            getStars(value);
    }
}


/* =========================================================
   LOGIN REQUIRED MODAL
========================================================= */

function openLoginRequiredModal() {

    if (!loginRequiredModal) {
        return;
    }


    loginRequiredModal.hidden =
        false;


    document.body.classList.add(
        "modal-open"
    );
}


/* =========================================================
   CLOSE LOGIN REQUIRED
========================================================= */

function closeLoginRequired() {

    if (!loginRequiredModal) {
        return;
    }


    loginRequiredModal.hidden =
        true;


    document.body.classList.remove(
        "modal-open"
    );
}


/* =========================================================
   BUY NOW
========================================================= */

function handleBuyNow() {

    if (!currentCourse) {

        showToast(
            "Please select a course first.",
            "error"
        );


        return;
    }


    if (!currentUser) {

        openLoginRequiredModal();


        return;
    }


    const courseId =
        currentCourse.id;


    const courseTitle =
        currentCourse.title;


    const price =
        Number(
            currentCourse.price
        ) || 0;


    const purchaseData = {

        courseId,

        courseTitle,

        price,

        userId:
            currentUser.uid,

        userEmail:
            currentUser.email || "",

        createdAt:
            new Date().toISOString()
    };


    try {

        sessionStorage.setItem(

            "learnify_pending_purchase",

            JSON.stringify(
                purchaseData
            )
        );


    } catch (error) {

        console.warn(
            "Could not save pending purchase:",
            error
        );
    }


    window.location.href =
        `payment.html?courseId=${encodeURIComponent(courseId)}`;
}


/* =========================================================
   AUTHENTICATION STATE
========================================================= */

function initializeAuthentication() {

    if (!auth) {

        currentUser =
            null;


        updateProfileUI();


        return;
    }


    onAuthStateChanged(

        auth,

        (user) => {

            currentUser =
                user || null;


            updateProfileUI();


            if (user) {

                console.log(
                    "Same Firebase user found:",
                    user.email
                );

            } else {

                console.log(
                    "No Firebase user currently signed in."
                );
            }

        },

        (error) => {

            logFirebaseError(
                "AUTHENTICATION STATE ERROR",
                error
            );


            currentUser =
                null;


            updateProfileUI();
        }
    );
}


/* =========================================================
   UPDATE PROFILE UI
========================================================= */

function updateProfileUI() {

    if (!currentUser) {

        if (profileAvatar) {

            profileAvatar.textContent =
                "S";
        }


        if (profileName) {

            profileName.textContent =
                "Student";
        }


        return;
    }


    const displayName =
        currentUser.displayName ||
        currentUser.email?.split("@")[0] ||
        "Student";


    const cleanName =
        displayName.trim();


    const initial =
        cleanName
            .charAt(0)
            .toUpperCase() ||
        "S";


    if (profileAvatar) {

        profileAvatar.textContent =
            initial;
    }


    if (profileName) {

        profileName.textContent =
            cleanName;
    }
}


/* =========================================================
   BACK BUTTON
========================================================= */

function handleBackButton() {

    if (
        window.history.length > 1
    ) {

        window.history.back();

        return;
    }


    window.location.href =
        "user-panel.html";
}


/* =========================================================
   MY COURSES
========================================================= */

function openMyCourses() {

    window.location.href =
        "my-courses.html";
}


/* =========================================================
   PROFILE
========================================================= */

function openProfile() {

    window.location.href =
        "profile.html";
}


/* =========================================================
   LOGIN BUTTON
========================================================= */

function goToLogin() {

    window.location.href =
        "login.html";
}


/* =========================================================
   KEYBOARD CONTROLS
========================================================= */

function handleKeyboard(event) {

    if (
        event.key !== "Escape"
    ) {

        return;
    }


    if (
        courseModal &&
        !courseModal.hidden
    ) {

        closeCourseDetailsModal();
    }


    if (
        loginRequiredModal &&
        !loginRequiredModal.hidden
    ) {

        closeLoginRequired();
    }
}


/* =========================================================
   MODAL OVERLAY CLICK
========================================================= */

function handleModalOverlayClick(
    event
) {

    if (
        event.target.classList.contains(
            "modal-overlay"
        )
    ) {

        closeCourseDetailsModal();
    }
}


/* =========================================================
   LOGIN MODAL BACKDROP
========================================================= */

function handleLoginModalClick(
    event
) {

    if (
        event.target ===
        loginRequiredModal
    ) {

        closeLoginRequired();
    }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function initializeEventListeners() {

    if (courseSearch) {

        courseSearch.addEventListener(
            "input",
            searchCourses
        );
    }


    if (coursesGrid) {

        coursesGrid.addEventListener(
            "click",
            handleCourseGridClick
        );
    }


    if (backButton) {

        backButton.addEventListener(
            "click",
            handleBackButton
        );
    }


    if (myCoursesButton) {

        myCoursesButton.addEventListener(
            "click",
            openMyCourses
        );
    }


    if (profileButton) {

        profileButton.addEventListener(
            "click",
            openProfile
        );
    }


    if (closeCourseModal) {

        closeCourseModal.addEventListener(
            "click",
            closeCourseDetailsModal
        );
    }


    if (courseModal) {

        courseModal.addEventListener(
            "click",
            handleModalOverlayClick
        );
    }


    if (buyNowButton) {

        buyNowButton.addEventListener(
            "click",
            handleBuyNow
        );
    }


    if (closeLoginModal) {

        closeLoginModal.addEventListener(
            "click",
            closeLoginRequired
        );
    }


    if (cancelLoginRequired) {

        cancelLoginRequired.addEventListener(
            "click",
            closeLoginRequired
        );
    }


    if (goToLoginButton) {

        goToLoginButton.addEventListener(
            "click",
            goToLogin
        );
    }


    if (loginRequiredModal) {

        loginRequiredModal.addEventListener(
            "click",
            handleLoginModalClick
        );
    }


    document.addEventListener(
        "keydown",
        handleKeyboard
    );
}


/* =========================================================
   CHECK REQUIRED DOM
========================================================= */

function checkDOM() {

    const requiredElements = [

        "#coursesGrid",

        "#courseCount",

        "#courseModal",

        "#feedbackList",

        "#buyNowButton"

    ];


    const missing =
        requiredElements.filter(
            (selector) =>
                !$(selector)
        );


    if (
        missing.length
    ) {

        console.warn(
            "Learnify missing HTML elements:",
            missing
        );
    }


    console.log(
        "Course grid:",
        coursesGrid
    );


    console.log(
        "Course count:",
        courseCount
    );


    console.log(
        "No courses element:",
        noCourses
    );


    console.log(
        "No results element:",
        noResults
    );
}


/* =========================================================
   INITIALIZE APPLICATION
========================================================= */

async function initializeAppPage() {

    console.log(
        "===================================="
    );

    console.log(
        "LEARNIFY ALL COURSES STARTING"
    );

    console.log(
        "===================================="
    );


    checkDOM();


    initializeEventListeners();


    initializeAuthentication();


    await initializeCourses();


    console.log(
        "===================================="
    );

    console.log(
        "LEARNIFY ALL COURSES READY"
    );

    console.log(
        "===================================="
    );
}


/* =========================================================
   START APPLICATION
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAppPage,
        {
            once: true
        }
    );

} else {

    initializeAppPage();
}


/* =========================================================
   GLOBAL ERROR LOGGING
========================================================= */

window.addEventListener(
    "error",
    (event) => {

        console.error(
            "Learnify page error:",
            event.error ||
            event.message
        );
    }
);


window.addEventListener(
    "unhandledrejection",
    (event) => {

        console.error(
            "Learnify promise error:",
            event.reason
        );
    }
);

/* =========================================================
   PAGE LOADER
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const pageLoader = document.getElementById("pageLoader");

    if (!pageLoader) return;

    // Keep loader visible while page loads
    pageLoader.style.display = "flex";

});


window.addEventListener("load", () => {

    const pageLoader = document.getElementById("pageLoader");

    if (!pageLoader) return;

    // Hide loader after everything is loaded
    setTimeout(() => {

        pageLoader.style.opacity = "0";
        pageLoader.style.visibility = "hidden";
        pageLoader.style.pointerEvents = "none";

    }, 500);

});

