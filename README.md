# KyberLock Universal
KyberLock Universal is a Chrome extension that adds KyberLock encryption to webmail apps. It is based on standalone KyberLock, also on GitHub, but it integrates with web-based email services. It also includes the password-generating code of SynthPass.

It is distributed as an extension for Chrome and its derivatives at (change this) https://chrome.google.com/webstore/detail/KyberLock-universal/lbmlbnfgnbfppkfijbbpnecpglockled and for Firefox at https://addons.mozilla.org/en-US/firefox/addon/KyberLock-universal/

KyberLock Universal is powerful, since it is based on Crystals-Kyber and Crystals-Dilithium, the recently standardized methods for post-quantum encryption and signatures. KyberLock Universal also includes the WiseHash variable-strength key derivation algorithm so users are not restricted in their choice of private keys. It includes four main modes of encryption: Anonymous, Signed, Read-once (similar to Off-The-Record messaging, but for email), and shared Key (symmetric), plus text steganography (Concealed and Invisible modes) and image steganography (into PNG or JPG images). Encrypted data can be can be part of the email body or be in the attachments.

KyberLock Universal is also designed to be very easy to use. The sender's Lock (public keys) is added to every encrypted message in Signed and Read-once modes, and retrieved automatically on the recipient's end so he/she does not need to bother with key management chores. The only key-management action requested of the user is entering his/her secret Key, from which the private keys derive when the encryption engine is initialized. Private data is retained in memory for five minutes beyond its last use and then deleted. It is never stored in any way.

KyberLock Universal also includes the functions of two other extensions published on GitHub: SynthPass, which synthesizes strong passwords for websites, and Page Cage, which isolates pages so other extensions can't mess with them. Which functions are active depend on page contents.

The extensions published in the Chrome and Firefox stores are identical, except for the manifest.json file. Those files are renamed in this repo so you know which is which.

First version is 1.0, so it begins (and hopefully stays) in sync with standalone KyberLock, also on GitHub. Releases begin with v0.5.2
