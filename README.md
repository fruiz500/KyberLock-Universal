# KyberLock-Universal
KyberLock quantum-proof encryption integrated with email, plus passwords.

KyberLock Universal is a Chrome and Firefox extension that adds KyberLock encryption to webmail apps. It is based on PassLok Universal, but it has the quantum-proof encryption engine of KyberLock. It also includes the password-generating code of SynthPass.

KyberLock Universal is powerful, since it is based on the recently standardized ML-KEM and ML-DSA algorithms for quantum-proof encryption. It also includes the WiseHash variable-strength key derivation algorithm so users are not restricted in their choice of private keys. It includes four main modes of encryption: Signed, Read-once (similar to Off-The-Record messaging, but for email), Anonymous, and shared Password (symmetric), plus text steganography (concealed and Invisible modes) and image steganography (into PNG or JPG images). Encrypted data can be can be part of the email body or be in the attachments.

KyberLock Universal is also designed to be very easy to use. The sender's Lock (public key) is added to every encrypted message, and retrieved automatically on the recipient's end so he/she does not need to bother with key management chores. The only key-management action requested of the user is entering his/her secret Password, from which the private key derives when the encryption engine is initialized. The private key is retained in memory for five minutes beyond the last use of it and then deleted. It is never stored in any way.

KyberLock Universal also includes the functions of two other extensions published on GitHub: SynthPass, which synthesizes strong passwords for websites, and Page Cage, which isolates pages so other extensions can't mess with them. Which functions are active depend on page contents.

The extensions published in the Chrome and Firefox stores are identical, except for the manifest.json file. Those files are renamed in this repo so you know which is which.
