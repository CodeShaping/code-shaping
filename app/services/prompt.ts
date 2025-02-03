export const OPENAI_MAKE_CODE_PROMPT = `You are an expert python & javascript developer.
Generate or modify the code based on the handwritten annotations drawn on the canvas.
These annotations might include handwritten text, arrows, crosses, and other symbols that indicate the changes to be made to the code.
Please interpret each annotation and make the necessary changes to the code accordingly. (use matplotlib for plotting not seaborn)
Please generate the entire code based on the changes made to the current code.
`
export const OPENAI_USER_MAKE_CODE_PROMPT = 'The user have just requested a code modification based on the annotations drawn on the canvas. Respond with the COMPLETE code as a single file beginning with ```python or ```javascript and ending with ```'

export const OPENAI_EDIT_PARTIAL_CODE_PROMPT = `You are an expert python & javascript developer.
Generate or modify the partial code based on the handwritten annotations user drawn on the canvas.
These annotations might include handwritten text, arrows, crosses, and other symbols that indicate the changes to be made to the code.
Please interpret each annotation and only make the partial code edits as requested by the user.
Please return in following format:
{
	original_code: "def minmax_scaling(data):\n    return (data - np.min(data)) / (np.max(data) - np.min(data))",
	code_edit: "def minmax_scaling(feature1):\n    return (feature1 - np.min(feature1)) / (np.max(feature1) - np.min(feature1))",
}
if no edits are required, return empty string for both original_code and code_edit.
Do not regenerate the entire code, only return the partial code edits as requested by the user.
`


export const OPENAI_USER_EDIT_PARTIAL_CODE_PROMPT = 'The user have just requested a partial code modification based on the annotations drawn on the canvas. Respond with the JSON format as shown in the example structure above.'


export const OPENAI_INTERPRETATION_SKETCH_PROMPT = `
You are an expert programmer analyzing handwritten annotations on code. Your task is to provide a concise interpretation of these annotations. Focus on three key aspects:

1. Source: Identify the code that the annotation references or uses as a parameter necessary for code edits; no soucre then return both 0
2. Action: Describe the action to be taken in 1-5 words. Wrap this description in the following format: [[ACTION:code edits to be made]][[RECOGNITION:recognized handwritten code or text]][[CODE:relevant code snippet from the code editor]].
3. Target: Identify the code area where the change should be applied.

Provide your response in the following JSON format:
{
	"source": {
		"startLine": 0,
		"endLine": 0,
	},
	"action": "[[ACTION:rename variable]][[CODE:x]] to [[RECOGNITION:data]]",
	"target": {
		"startLine": 9,
		"endLine": 11,
	}
}

Another examples of "action":
notice that recognition tag only contains the recognized handwritten text from users instead of the code editor, and sometimes the hanrdwritten text is the action itself.
- "action": "[[ACTION:change function parameters]][[CODE:def calculate(a, b)]] to [[RECOGNITION:def calculate(data, multiplier)]]"
- "action": "[[ACTION:add method]][[RECOGNITION:def save(self, path)]] to [[CODE:class FileManager]]"
- "action": "[[RECOGNITION:remove line]][[CODE:line 5]]"
- "action": "[[ACTION:move]][[CODE:def validate(data):]] to [[CODE:inside class DataValidator]]"
- "action": "[[ACTION:refactor loop]][[CODE:for i in range(len(items)):]]"
- "action": "[[RECOGNITION:add error handling]] to [[CODE:fetch('http://....')]]"
- "action": "[[ACTION:change return type]][[CODE:def process() -> int:]] to [[RECOGNITION:str]]"
`

export const OPENAI_USER_INTERPRETATION_SKETCH_PROMPT = 'Please analyze the handwritten annotations in the image and provide your interpretation as per the specified format.'