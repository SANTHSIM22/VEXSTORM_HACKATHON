const cheerio = require('cheerio');

class FormAnalyzer {
    analyze(html, url) {
        const $ = cheerio.load(html);
        const forms = [];

        $('form').each((_, form) => {
            const $form = $(form);
            const formInfo = {
                action: $form.attr('action') || url,
                method: ($form.attr('method') || 'GET').toUpperCase(),
                enctype: $form.attr('enctype') || 'application/x-www-form-urlencoded',
                id: $form.attr('id') || null,
                inputs: [],
                hasPasswordField: false,
                hasFileUpload: false,
                hasHiddenFields: false,
                hasCsrfToken: false,
            };

            $form.find('input, textarea, select').each((__, input) => {
                const $input = $(input);
                const field = {
                    tag: input.tagName,
                    name: $input.attr('name') || '',
                    type: $input.attr('type') || 'text',
                    value: $input.attr('value') || '',
                    required: $input.attr('required') !== undefined,
                    placeholder: $input.attr('placeholder') || '',
                };

                if (field.type === 'password') formInfo.hasPasswordField = true;
                if (field.type === 'file') formInfo.hasFileUpload = true;
                if (field.type === 'hidden') {
                    formInfo.hasHiddenFields = true;
                    if (/csrf|token|nonce/i.test(field.name)) {
                        formInfo.hasCsrfToken = true;
                    }
                }

                formInfo.inputs.push(field);
            });

            forms.push(formInfo);
        });

        return forms;
    }
}

module.exports = FormAnalyzer;
