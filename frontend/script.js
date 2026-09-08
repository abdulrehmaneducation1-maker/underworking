
/* =========================================================
   LEARNIFY COURSE WEBSITE
   Main JavaScript
   ========================================================= */

"use strict";


/* =========================================================
   1. DOM ELEMENTS
   ========================================================= */

const body = document.body;

const pageLoader =
    document.getElementById("pageLoader");

const siteHeader =
    document.getElementById("siteHeader");

const mobileMenuBtn =
    document.getElementById("mobileMenuBtn");

const mobileNavigation =
    document.getElementById("mobileNavigation");

const themeToggle =
    document.getElementById("themeToggle");

const themeIcon =
    document.querySelector(".theme-icon");

const currentYear =
    document.getElementById("currentYear");

const navLinks =
    document.querySelectorAll(".nav-link");

const mobileNavLinks =
    document.querySelectorAll(".mobile-nav-link");


/* =========================================================
   2. PAGE LOADER
   ========================================================= */

window.addEventListener("load", () => {

    setTimeout(() => {

        if (pageLoader) {
            pageLoader.classList.add("hidden");
        }

    }, 500);

});


/* =========================================================
   3. CURRENT YEAR
   ========================================================= */

if (currentYear) {
    currentYear.textContent =
        new Date().getFullYear();
}


/* =========================================================
   4. HEADER SCROLL EFFECT
   ========================================================= */

function handleHeaderScroll() {

    if (!siteHeader) {
        return;
    }

    if (window.scrollY > 20) {
        siteHeader.classList.add("scrolled");
    } else {
        siteHeader.classList.remove("scrolled");
    }

}

window.addEventListener(
    "scroll",
    handleHeaderScroll,
    { passive: true }
);

handleHeaderScroll();


/* =========================================================
   5. MOBILE MENU
   ========================================================= */

function openMobileMenu() {

    if (!mobileMenuBtn || !mobileNavigation) {
        return;
    }

    mobileMenuBtn.classList.add("active");

    mobileNavigation.classList.add("open");

    mobileMenuBtn.setAttribute(
        "aria-expanded",
        "true"
    );

    mobileMenuBtn.setAttribute(
        "aria-label",
        "Close navigation menu"
    );

}


function closeMobileMenu() {

    if (!mobileMenuBtn || !mobileNavigation) {
        return;
    }

    mobileMenuBtn.classList.remove("active");

    mobileNavigation.classList.remove("open");

    mobileMenuBtn.setAttribute(
        "aria-expanded",
        "false"
    );

    mobileMenuBtn.setAttribute(
        "aria-label",
        "Open navigation menu"
    );

}


function toggleMobileMenu() {

    if (!mobileNavigation) {
        return;
    }

    if (
        mobileNavigation.classList.contains("open")
    ) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }

}


if (mobileMenuBtn) {

    mobileMenuBtn.addEventListener(
        "click",
        toggleMobileMenu
    );

}


/* =========================================================
   6. CLOSE MOBILE MENU AFTER CLICK
   ========================================================= */

mobileNavLinks.forEach((link) => {

    link.addEventListener("click", () => {

        closeMobileMenu();

    });

});


/* =========================================================
   7. CLOSE MENU WHEN CLICKING OUTSIDE
   ========================================================= */

document.addEventListener("click", (event) => {

    if (
        !mobileNavigation ||
        !mobileMenuBtn
    ) {
        return;
    }

    const clickedInsideMenu =
        mobileNavigation.contains(event.target);

    const clickedMenuButton =
        mobileMenuBtn.contains(event.target);

    if (
        !clickedInsideMenu &&
        !clickedMenuButton &&
        mobileNavigation.classList.contains("open")
    ) {
        closeMobileMenu();
    }

});


/* =========================================================
   8. CLOSE MENU WITH ESCAPE
   ========================================================= */

document.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {

        closeMobileMenu();

    }

});


/* =========================================================
   9. RESPONSIVE MENU RESET
   ========================================================= */

window.addEventListener("resize", () => {

    if (
        window.innerWidth > 800 &&
        mobileNavigation
    ) {
        closeMobileMenu();
    }

});


/* =========================================================
   10. DARK / LIGHT MODE
   ========================================================= */

const savedTheme =
    localStorage.getItem("learnify-theme");


function applyTheme(theme) {

    if (theme === "dark") {

        body.classList.add("dark-mode");

        if (themeIcon) {
            themeIcon.textContent = "☀";
        }

        if (themeToggle) {
            themeToggle.setAttribute(
                "aria-label",
                "Switch to light mode"
            );

            themeToggle.setAttribute(
                "title",
                "Switch to light mode"
            );
        }

    } else {

        body.classList.remove("dark-mode");

        if (themeIcon) {
            themeIcon.textContent = "☾";
        }

        if (themeToggle) {
            themeToggle.setAttribute(
                "aria-label",
                "Switch to dark mode"
            );

            themeToggle.setAttribute(
                "title",
                "Switch to dark mode"
            );
        }

    }

}


if (savedTheme) {

    applyTheme(savedTheme);

} else {

    const prefersDark =
        window.matchMedia &&
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;

    applyTheme(
        prefersDark ? "dark" : "light"
    );

}


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            const isDark =
                body.classList.contains("dark-mode");

            const newTheme =
                isDark ? "light" : "dark";

            applyTheme(newTheme);

            localStorage.setItem(
                "learnify-theme",
                newTheme
            );

        }
    );

}


/* =========================================================
   11. SMOOTH ANCHOR SCROLLING
   ========================================================= */

document.querySelectorAll(
    'a[href^="#"]'
).forEach((link) => {

    link.addEventListener(
        "click",
        (event) => {

            const targetId =
                link.getAttribute("href");

            if (
                !targetId ||
                targetId === "#"
            ) {
                return;
            }

            const target =
                document.querySelector(targetId);

            if (!target) {
                return;
            }

            event.preventDefault();

            const headerHeight =
                siteHeader
                    ? siteHeader.offsetHeight
                    : 0;

            const targetPosition =
                target.getBoundingClientRect().top +
                window.scrollY -
                headerHeight -
                10;

            window.scrollTo({
                top: targetPosition,
                behavior: "smooth"
            });

        }
    );

});


/* =========================================================
   12. ACTIVE NAVIGATION
   ========================================================= */

const sections =
    document.querySelectorAll(
        "main section[id]"
    );


function updateActiveNavigation() {

    if (!sections.length) {
        return;
    }

    const scrollPosition =
        window.scrollY + 150;

    let currentSection = "";

    sections.forEach((section) => {

        const sectionTop =
            section.offsetTop;

        const sectionHeight =
            section.offsetHeight;

        if (
            scrollPosition >= sectionTop &&
            scrollPosition <
                sectionTop + sectionHeight
        ) {
            currentSection =
                section.getAttribute("id");
        }

    });


    navLinks.forEach((link) => {

        const href =
            link.getAttribute("href");

        link.classList.toggle(
            "active",
            href === `#${currentSection}`
        );

    });

}


window.addEventListener(
    "scroll",
    updateActiveNavigation,
    { passive: true }
);

updateActiveNavigation();


/* =========================================================
   13. SCROLL REVEAL
   ========================================================= */

function addRevealAnimations() {

    const elements =
        document.querySelectorAll(
            ".category-card, " +
            ".course-card, " +
            ".benefit-item, " +
            ".instructor-card, " +
            ".section-heading, " +
            ".achievement-card, " +
            ".mini-stat-card"
        );

    elements.forEach((element) => {

        element.classList.add("reveal");

    });

}


addRevealAnimations();


const revealObserver =
    new IntersectionObserver(
        (entries, observer) => {

            entries.forEach((entry) => {

                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add(
                    "visible"
                );

                observer.unobserve(
                    entry.target
                );

            });

        },
        {
            threshold: 0.12,
            rootMargin: "0px 0px -30px 0px"
        }
    );


document
    .querySelectorAll(".reveal")
    .forEach((element) => {

        revealObserver.observe(element);

    });


/* =========================================================
   14. COURSE BUTTON FEEDBACK
   ========================================================= */

const courseButtons =
    document.querySelectorAll(
        ".course-btn"
    );


courseButtons.forEach((button) => {

    button.addEventListener(
        "click",
        () => {

            button.style.transform =
                "scale(0.96)";

            setTimeout(() => {

                button.style.transform =
                    "";

            }, 120);

        }
    );

});


/* =========================================================
   15. CONTINUE LEARNING BUTTON
   ========================================================= */

const continueButton =
    document.querySelector(
        ".continue-btn"
    );


if (continueButton) {

    continueButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "../user-panel/user-panel.html";

        }
    );

}


/* =========================================================
   16. HERO PARALLAX
   ========================================================= */

const heroVisual =
    document.querySelector(
        ".hero-visual"
    );


let ticking = false;


function updateHeroParallax() {

    if (
        !heroVisual ||
        window.innerWidth < 801
    ) {
        ticking = false;
        return;
    }

    const scrollY =
        window.scrollY;

    const offset =
        Math.min(
            scrollY * 0.08,
            35
        );

    heroVisual.style.transform =
        `translateY(${offset}px)`;

    ticking = false;

}


window.addEventListener(
    "scroll",
    () => {

        if (!ticking) {

            window.requestAnimationFrame(
                updateHeroParallax
            );

            ticking = true;

        }

    },
    { passive: true }
);


/* =========================================================
   17. PREVENT EMPTY HASH JUMP
   ========================================================= */

document.querySelectorAll(
    'a[href="#"]'
).forEach((link) => {

    link.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

        }
    );

});


/* =========================================================
   18. KEYBOARD ACCESSIBILITY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter" &&
            document.activeElement ===
                mobileMenuBtn
        ) {

            toggleMobileMenu();

        }

    }
);


/* =========================================================
   19. REDUCED MOTION CHECK
   ========================================================= */

const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;


if (prefersReducedMotion) {

    document.documentElement.style
        .scrollBehavior = "auto";

}


/* =========================================================
   20. INITIALIZATION MESSAGE
   ========================================================= */

console.log(
    "Learnify frontend initialized successfully."
);

