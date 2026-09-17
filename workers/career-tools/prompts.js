export const SYSTEM_PROMPT = `You are an expert career coach with 15 years of experience helping professionals land jobs at top companies. You give specific, actionable, professional advice. Be concise and direct. Never add unnecessary disclaimers.`;

export const TOOL_PROMPTS = {
  'cover-letter-generator': (inputs) => `Write a professional cover letter for the following:
Job Title: ${inputs.jobTitle}
Company: ${inputs.company}
Candidate's experience:
${inputs.experience}
Tone: ${inputs.tone || 'Professional'}

Write a compelling 3-paragraph cover letter (opening hook, relevant experience, strong close). Address it "Dear Hiring Manager". Do not use placeholders — write the complete letter ready to send.`,

  'resume-analyzer': (inputs) => `Analyze this resume against the job description and provide a structured critique.

RESUME:
${inputs.resume}

JOB DESCRIPTION:
${inputs.jobDescription}

Provide:
1. **Match Score**: Estimate 0-100%
2. **Key Strengths**: What the resume does well for this role
3. **Critical Gaps**: Missing keywords or skills the JD requires
4. **Top 5 Improvements**: Specific, actionable changes to make
5. **Keywords to Add**: Exact phrases from the JD missing from the resume`,

  'interview-questions-generator': (inputs) => `Generate interview preparation for a ${inputs.experienceLevel} ${inputs.jobTitle} role.
${inputs.focusArea ? `Focus area: ${inputs.focusArea}` : ''}

Provide:
1. **5 Behavioral Questions** (STAR format expected) with a suggested talking point for each
2. **5 Technical/Role-Specific Questions** with key points to cover in answers
3. **3 Questions to Ask the Interviewer** that demonstrate strategic thinking
4. **1 Tricky Question** likely to trip up candidates with advice on how to handle it`,

  'job-description-analyzer': (inputs) => `Analyze this job description thoroughly:

${inputs.jobDescription}

Provide:
1. **Must-Have Skills**: Non-negotiable requirements (rank by importance)
2. **Nice-to-Have Skills**: Preferred but not required
3. **Salary Signals**: Any hints about compensation range or level
4. **Red Flags**: Concerning language (e.g., "wear many hats", "fast-paced", vague requirements)
5. **What They Really Want**: The 2-3 core things this role actually needs
6. **Application Strategy**: How to tailor your application for maximum impact`,

  'salary-estimator': (inputs) => `Provide a salary analysis for:
Job Title: ${inputs.jobTitle}
Location: ${inputs.location}
Experience: ${inputs.yearsExperience}
${inputs.industry ? `Industry: ${inputs.industry}` : ''}

Provide:
1. **Estimated Salary Range**: Base salary low / mid / high for this role/location/experience
2. **Total Compensation**: Typical bonus, equity, and benefits to expect
3. **Market Factors**: What's driving salaries up or down for this role right now
4. **Negotiation Leverage**: 3 specific factors that could get you to the top of the range
5. **First Number**: Whether to give a number first or make them go first, and what to say`,
};
