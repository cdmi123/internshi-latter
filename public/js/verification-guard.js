(() => {
    let redirecting = false;

    const returnToVerification = () => {
        if (redirecting) return;
        redirecting = true;
        document.body.classList.add('verification-away');
        window.location.replace('/verify');
    };

    window.history.pushState({ verificationPage: true }, '', window.location.href);

    window.addEventListener('popstate', returnToVerification);
    window.addEventListener('blur', returnToVerification);
    window.addEventListener('beforeprint', returnToVerification);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') returnToVerification();
    });
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (!link || link.origin !== window.location.origin || link.pathname === '/verify') return;
        event.preventDefault();
        returnToVerification();
    });
    window.addEventListener('keydown', (event) => {
        if (event.key === 'PrintScreen') {
            event.preventDefault();
            window.location.reload();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            returnToVerification();
        }
    });
})();
