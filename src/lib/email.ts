import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "noreply@kalvium.community";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

async function sendEmail(to: string, subject: string, html: string) {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.warn("SMTP credentials missing. Email not sent:", { to, subject });
        return;
    }

    try {
        await transporter.sendMail({
            from: SMTP_FROM,
            to,
            subject,
            html,
        });
        console.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

export async function sendCaseReportedEmail(
    to: string,
    incidentId: string,
    description: string,
    dateTime: string,
    attachments: string[] = []
) {
    const subject = `Kalvium IRS | New Case Reported`;
    const link = `${APP_URL}/my-cases`;

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">

            <p>A new case has been reported where you are listed as the reported individual.</p>
            
            <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Incident ID:</strong> ${incidentId}</p>
                <p><strong>Date & Time:</strong> ${dateTime}</p>
                <p><strong>Description:</strong></p>
                <p>${description}</p>
                
                ${attachments.length > 0 ? `
                    <p><strong>Attachments:</strong></p>
                    <ul>
                        ${attachments.map((url, i) => `<li><a href="${url}">Attachment ${i + 1}</a></li>`).join('')}
                    </ul>
                ` : ''}
            </div>

            <p>You can view the details of this case by logging into the portal.</p>
            <p><a href="${link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Case</a></p>
        </div>
    `;

    await sendEmail(to, subject, html);
}

export async function sendStatusUpdateEmail(
    to: string,
    incidentId: string,
    status: string,
    details: {
        description: string;
        dateTime: string;
        category?: string;
        subCategory?: string;
        level?: string;
        verdict?: string;
        complainantEmail?: string;
    }
) {
    const subject = `Kalvium IRS | ${status}`;
    const link = `${APP_URL}/my-cases`;

    // Logic for displaying specific details based on status
    let statusMessage = "";
    if (status === "Verdict Given") {
        statusMessage = "A verdict has been recorded for your case. If you have been found Guilty, you may be eligible to appeal within 7 days.";
    } else if (status === "Final Decision") {
        statusMessage = "A final decision has been reached for your case. This decision is final and cannot be appealed further.";
    } else if (status === "Appealed") {
        statusMessage = "Your appeal has been submitted and is currently under review.";
    } else {
        statusMessage = `The status of your case has changed to: ${status}`;
    }

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <p>${statusMessage}</p>
            
            <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Incident ID:</strong> ${incidentId}</p>
                <p><strong>Status:</strong> ${status}</p>
                ${details.verdict ? `<p><strong>Verdict:</strong> <span style="font-weight:bold; color: ${details.verdict === 'Guilty' ? 'red' : 'green'}">${details.verdict}</span></p>` : ''}
                ${details.level ? `<p><strong>Level of Offence:</strong> ${details.level}</p>` : ''}
                
                <hr style="border: 0; border-top: 1px solid #ddd; margin: 15px 0;">
                
                <p><strong>Description:</strong> ${details.description}</p>
                <p><strong>Date & Time:</strong> ${details.dateTime}</p>
                ${details.category ? `<p><strong>Category:</strong> ${details.category}</p>` : ''}
                ${details.complainantEmail ? `<p><strong>Complainant:</strong> ${details.complainantEmail}</p>` : ''}
            </div>

            <p><a href="${link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Case Details</a></p>
        </div>
    `;

    await sendEmail(to, subject, html);
}

export async function sendAppealConfirmationEmail(
    to: string,
    incidentId: string,
    appealReason: string,
    attachments: string[]
) {
    const subject = `Kalvium IRS | Appeal Submitted`;

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Your appeal for Case ${incidentId} has been successfully submitted and is under review. We will notify you once a final decision is reached</p>
            
            <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Appeal Description:</strong></p>
                <div style="background: white; padding: 10px; border-radius: 4px;">${appealReason.replace(/\n/g, '<br>')}</div>
                
                ${attachments.length > 0 ? `
                    <p><strong>Attachments:</strong></p>
                    <ul>
                        ${attachments.map((url, i) => `<li><a href="${url}">Attachment ${i + 1}</a></li>`).join('')}
                    </ul>
                ` : ''}
            </div>

        </div>
    `;

    await sendEmail(to, subject, html);
}

export async function sendAppealNotificationEmail(
    to: string[], // List of approvers/investigators
    incidentId: string,
    reportedBy: string,
    appealReason: string,
    attachments: string[] = []
) {
    const subject = `Kalvium IRS | New Appeal Submitted`;
    const link = `${APP_URL}/investigation-hub/${incidentId}`;

    // We send individual emails or bcc? Map over recipients is safer/easier.
    for (const email of to) {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <p>An appeal has been submitted for Case ${incidentId}.</p>
                
                <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Reported By:</strong> ${reportedBy}</p>
                    <p><strong>Appeal Description:</strong></p>
                    <div style="background: white; padding: 10px; border-radius: 4px;">${appealReason.replace(/\n/g, '<br>')}</div>
                    
                    ${attachments.length > 0 ? `
                        <p><strong>Attachments:</strong></p>
                        <ul>
                            ${attachments.map((url, i) => `<li><a href="${url}">Attachment ${i + 1}</a></li>`).join('')}
                        </ul>
                    ` : ''}
                </div>

                <p><a href="${link}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Review Appeal</a></p>
            </div>
        `;
        await sendEmail(email, subject, html);
    }
}
